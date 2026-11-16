import test from 'node:test';import assert from 'node:assert/strict';
import {PRESETS,cell,makeTraining,validatePosition} from '../public/training.js';
import {winning} from '../public/game.js';import {chooseMove} from '../public/ai.js';
const wins=(b,mark)=>b.flatMap((v,i)=>{if(v)return [];const c=[...b];c[i]=mark;return winning(c,i).length?[i]:[];});
test('presets have valid nonterminal boards and explicit turn; edits do not mutate templates',()=>{
 for(const p of PRESETS){assert.equal(validatePosition(p.board,p.toMove,p.humanMark),true);const t=makeTraining(p);t.board.fill(2);assert.notDeepEqual(p.board,t.board);}
});
test('gap finishes five and defense has exactly one blocking point',()=>{
 const gap=PRESETS.find(p=>p.id==='gap');assert.deepEqual(wins(gap.board,1),[cell(gap.solution)]);
 const defend=PRESETS.find(p=>p.id==='defend');assert.deepEqual(wins(defend.board,2),[cell(defend.solution)]);
 assert.equal(chooseMove(defend.board,8,()=>0,1),cell(defend.solution));
});
test('double four guarantees next-turn win after every possible defense',()=>{
 const p=PRESETS.find(p=>p.id==='double-four'),b=[...p.board];b[cell(p.solution)]=1;
 assert.equal(wins(b,2).length,0);assert.ok(wins(b,1).length>=2);
 for(let i=0;i<b.length;i++)if(!b[i]){const c=[...b];c[i]=2;assert.ok(wins(c,1).length>0);}
});
test('four-three forces I8 then open four; double-three defeats every defense',()=>{
 const p=PRESETS.find(p=>p.id==='four-three'),b=[...p.board];b[cell('H8')]=1;assert.deepEqual(wins(b,1),[cell('I8')]);b[cell('I8')]=2;b[cell('H9')]=1;assert.equal(wins(b,2).length,0);assert.deepEqual(wins(b,1),[cell('H5'),cell('H10')]);
 const d=[...PRESETS.find(p=>p.id==='double-three').board];d[cell('H8')]=1;
 for(let i=0;i<d.length;i++)if(!d[i]){const c=[...d];c[i]=2;assert.equal(wins(c,2).length,0);assert.ok(['E8','I8','H5','H9'].some(s=>{const j=cell(s);if(c[j])return false;const e=[...c];e[j]=1;return wins(e,1).length>=2;}),`no open four after ${i}`);}
});
test('custom positions allow uneven counts, but reject wins, invalid symbols and missing turn',()=>{
 const b=Array(361).fill(0);b[20]=1;b[30]=1;b[40]=1;assert.equal(validatePosition(b,2,2),true);
 assert.throws(()=>validatePosition(b,0,1));assert.throws(()=>validatePosition(b,1,0));assert.throws(()=>validatePosition([],1,1));b[0]=3;assert.throws(()=>validatePosition(b,1,1));b[0]=0;for(let i=50;i<55;i++)b[i]=2;assert.throws(()=>validatePosition(b,1,1));
});
test('AI can play either symbol and preserves the caller board',()=>{
 for(const mark of [1,2]){const b=Array(361).fill(0);b[180]=3-mark;for(let i=181;i<185;i++)b[i]=mark;const before=[...b];assert.equal(chooseMove(b,8,()=>0,mark),185);assert.deepEqual(b,before);}
 assert.equal(chooseMove(Array(361).fill(0),1,()=>0,1),180);
});
