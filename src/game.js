export const SIZE=19, TURN=40000, RECONNECT=60000;
export function winning(board,index){
 const mark=board[index]; if(!mark)return [];
 const x=index%SIZE,y=Math.floor(index/SIZE),lines=[];
 for(const [dx,dy] of [[1,0],[0,1],[1,1],[1,-1]]){
  const line=[index];for(const sign of [-1,1]){let a=x+dx*sign,b=y+dy*sign;while(a>=0&&a<SIZE&&b>=0&&b<SIZE&&board[b*SIZE+a]===mark){line.push(b*SIZE+a);a+=dx*sign;b+=dy*sign;}}
  if(line.length>=5)lines.push(...line);
 }return [...new Set(lines)];
}
export function elo(a,b,score){const change=Math.round(32*(score-1/(1+10**((b-a)/400))));return [a+change,b-change];}
export const OPENING_RULES=['none','swap','swap2'];
export function openingRule(value='none'){
 if(!OPENING_RULES.includes(value))throw Error('Neplatné pravidlo zahájení.');
 return value;
}
// first is the opening proposer, never changed by choosing a colour.
// marks maps seat -> symbol and falls back for games saved before this feature.
export function playerMark(game,seat){return game?.marks?.[seat]??(seat===(game?.first??0)?1:2);}
export function nextMark(game){return game.opening?([1,2,1,2,1][game.opening.placed]??0):playerMark(game,game.turn);}
export function newGame(players,first=0,rule='none'){
 openingRule(rule);
 return {id:crypto.randomUUID(),board:Array(SIZE*SIZE).fill(0),players:[...players],first,turn:first,marks:first===0?[1,2]:[2,1],openingRule:rule,
  opening:rule==='none'?null:{phase:'place3',placed:0},status:'playing',deadline:Date.now()+TURN,last:null,win:[],drawCounts:[0,0],draw:null,rematch:null,disconnected:{}};
}
function validateActor(game,user,now){
 if(game.status!=='playing')throw Error('Partie právě neprobíhá.');
 if(game.players[game.turn]!==user)throw Error('Nyní hraje soupeř.');
 if(game.paused)throw Error('Čekáme na návrat soupeře.');
 if(now>=game.deadline)throw Error('Čas na tah vypršel.');
}
function advance(game,seat,now){
 game.turn=seat;game.deadline=now+TURN;
 if(game.disconnected[game.players[seat]]){game.paused=true;game.remaining=TURN;}
}
export function chooseOpening(game,user,choice,now=Date.now()){
 validateActor(game,user,now);
 const o=game.opening;
 if(!o||!['choose','chooseFinal'].includes(o.phase))throw Error('Teď se symbol nevybírá.');
 if(choice==='extend'){
  if(game.openingRule!=='swap2'||o.phase!=='choose')throw Error('Další dva kameny lze přidat jen jednou ve Swap2.');
  o.phase='place2';advance(game,game.turn,now);return;
 }
 if(choice!==1&&choice!==2)throw Error('Vyber křížky nebo kolečka.');
 game.marks[game.turn]=choice;game.marks[1-game.turn]=3-choice;game.opening=null;
 // Three/five stones already placed: the next stone is always the second colour.
 advance(game,game.marks.indexOf(2),now);
}
export function move(game,user,index,now=Date.now()){
 validateActor(game,user,now);
 if(game.opening&&['choose','chooseFinal'].includes(game.opening.phase))throw Error('Nejdříve zvol symbol nebo přidání kamenů.');
 if(!Number.isInteger(index)||index<0||index>=SIZE*SIZE||game.board[index])throw Error('Vyberte prázdné políčko.');
 game.board[index]=nextMark(game);game.last=index;
 if(game.opening){
  const o=game.opening;o.placed++;
  if(o.placed===3){o.phase='choose';advance(game,1-game.first,now);}
  else if(o.placed===5){o.phase='chooseFinal';advance(game,game.first,now);}
  else advance(game,game.turn,now);
  return null;
 }
 game.win=winning(game.board,index);
 if(game.win.length)return {winner:user,reason:'řada'};
 if(game.board.every(Boolean))return {winner:null,reason:'plná deska'};
 advance(game,1-game.turn,now);return null;
}
export function disconnect(game,user,now=Date.now()){
 if(game.status!=='playing'||game.disconnected[user])return null;
 const expired=Object.entries(game.disconnected).find(([,v])=>v.until<=now);
 if(expired)return {winner:game.players.find(p=>p!==expired[0]),reason:'odpojení'};
 if(now>=game.deadline&&!Object.keys(game.disconnected).length)return {winner:game.players[1-game.turn],reason:'čas'};
 game.disconnected[user]={until:now+RECONNECT};
 if(game.players[game.turn]===user&&!game.paused){game.remaining=Math.max(0,game.deadline-now);game.paused=true;}
 if(Object.keys(game.disconnected).length===2)return {winner:null,reason:'anulováno',annulled:true};return null;
}
export function reconnect(game,user,now=Date.now()){
 const item=game.disconnected[user];if(!item)return null;
 if(now>=item.until)return {winner:game.players.find(p=>p!==user),reason:'odpojení'};
 delete game.disconnected[user];if(game.paused&&game.players[game.turn]===user){game.deadline=now+Math.max(10000,game.remaining||0);game.paused=false;}return null;
}
