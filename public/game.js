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
export function newGame(players,first=0){return {id:crypto.randomUUID(),board:Array(361).fill(0),players:[...players],first,turn:first,status:'playing',deadline:Date.now()+TURN,last:null,win:[],drawCounts:[0,0],draw:null,rematch:null,disconnected:{}};}
export function move(game,user,index,now=Date.now()){
 if(game.status!=='playing')throw Error('Partie právě neprobíhá.');
 if(game.players[game.turn]!==user)throw Error('Nyní hraje soupeř.');
 if(game.paused)throw Error('Čekáme na návrat soupeře.');
 if(now>=game.deadline)throw Error('Čas na tah vypršel.');
 if(!Number.isInteger(index)||index<0||index>=361||game.board[index])throw Error('Vyberte prázdné políčko.');
 game.board[index]=game.turn===game.first?1:2;game.last=index;game.win=winning(game.board,index);
 if(game.win.length)return {winner:user,reason:'řada'};
 if(game.board.every(Boolean))return {winner:null,reason:'plná deska'};
 game.turn=1-game.turn;game.deadline=now+TURN;if(game.disconnected[game.players[game.turn]]){game.paused=true;game.remaining=TURN;}return null;
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
