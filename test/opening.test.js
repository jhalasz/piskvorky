import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,move,chooseOpening,playerMark,nextMark,disconnect,reconnect,TURN} from '../src/game.js';
import {readFileSync} from 'node:fs';
function place3(g){for(const i of [180,181,200])move(g,g.players[g.turn],i);}
test('client and server rules stay identical',()=>assert.equal(readFileSync('src/game.js','utf8'),readFileSync('public/game.js','utf8')));
for(const rule of ['swap','swap2'])for(const first of [0,1])for(const choice of [1,2])test(`${rule}, proposer ${first}, chooser takes ${choice}`,()=>{
 const g=newGame(['a','b'],first,rule);assert.equal(g.turn,first);
 assert.throws(()=>chooseOpening(g,g.players[first],1));
 place3(g);assert.deepEqual([g.board[180],g.board[181],g.board[200]],[1,2,1]);
 assert.equal(g.turn,1-first);assert.equal(g.opening.phase,'choose');
 assert.throws(()=>move(g,g.players[g.turn],201));assert.throws(()=>chooseOpening(g,g.players[first],1));
 chooseOpening(g,g.players[1-first],choice);assert.equal(g.opening,null);assert.equal(playerMark(g,1-first),choice);
 assert.equal(nextMark(g),2);move(g,g.players[g.turn],201);assert.equal(g.board[201],2);
 move(g,g.players[g.turn],202);assert.equal(g.board[202],1);assert.equal(g.first,first);
});
for(const first of [0,1])for(const choice of [1,2])test(`swap2 extension, proposer ${first} takes ${choice}, persists through JSON`,()=>{
 let g=newGame(['a','b'],first,'swap2');place3(g);chooseOpening(g,g.players[g.turn],'extend');
 move(g,g.players[1-first],201);g=JSON.parse(JSON.stringify(g));assert.equal(g.turn,1-first);assert.equal(nextMark(g),1);
 move(g,g.players[1-first],202);assert.equal(g.turn,first);assert.equal(g.opening.phase,'chooseFinal');
 assert.throws(()=>chooseOpening(g,g.players[first],'extend'));chooseOpening(g,g.players[first],choice);
 assert.equal(g.marks[first],choice);assert.equal(nextMark(g),2);move(g,g.players[g.turn],203);assert.equal(g.board[203],2);
 const rematch=newGame(g.players,1-g.first,g.openingRule);assert.equal(rematch.turn,1-first);assert.equal(rematch.opening.placed,0);
});
test('swap cannot extend; invalid values/expired choices cannot mutate a game',()=>{
 assert.throws(()=>newGame(['a','b'],0,'invalid'));
 const g=newGame(['a','b'],0,'swap');place3(g);const before=JSON.stringify(g);
 for(const c of ['extend',0,3,'1',null])assert.throws(()=>chooseOpening(g,'b',c));
 assert.throws(()=>chooseOpening(g,'b',1,g.deadline));assert.equal(JSON.stringify(g),before);
});
test('disconnect and reconnect during choice preserve the phase and pause correct actor',()=>{
 const g=newGame(['a','b'],0,'swap2');place3(g);const now=g.deadline-20000;
 disconnect(g,'b',now);assert.throws(()=>chooseOpening(g,'b',1,now+1));
 reconnect(g,'b',now+1000);assert.equal(g.opening.phase,'choose');chooseOpening(g,'b',2,now+1001);
 assert.equal(g.turn,1);assert.equal(g.deadline,now+1001+TURN);
});
test('handoff to disconnected chooser pauses, and legacy games retain their symbols',()=>{
 const g=newGame(['a','b'],0,'swap');disconnect(g,'b',g.deadline-30000);place3(g);assert.equal(g.paused,true);assert.equal(g.turn,1);
 const old=newGame(['a','b'],1);delete old.marks;delete old.opening;delete old.openingRule;move(old,'b',180);assert.equal(old.board[180],1);move(old,'a',181);assert.equal(old.board[181],2);
});
