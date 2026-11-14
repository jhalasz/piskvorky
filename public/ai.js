import {winning} from './game.js';
const dirs=[[1,0],[0,1],[1,1],[1,-1]];
function value(board,i,mark){let score=0;const x=i%19,y=Math.floor(i/19);for(const [dx,dy]of dirs){let n=1,open=0;for(const sign of [-1,1]){let a=x+dx*sign,b=y+dy*sign;while(a>=0&&a<19&&b>=0&&b<19&&board[b*19+a]===mark){n++;a+=dx*sign;b+=dy*sign;}if(a>=0&&a<19&&b>=0&&b<19&&!board[b*19+a])open++;}score+=n>=5?1e8:n===4?(open===2?1e6:open?1e5:0):n===3?(open===2?16000:open?700:0):n===2?(open===2?500:open?50:0):open*5;}return score;}
export function chooseMove(board,level=1,random=Math.random){
 const occupied=board.flatMap((v,i)=>v?[i]:[]);if(!occupied.length)return 180;
 const near=new Set();for(const i of occupied){const x=i%19,y=Math.floor(i/19);for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const a=x+dx,b=y+dy;if(a>=0&&a<19&&b>=0&&b<19&&!board[b*19+a])near.add(b*19+a);}}
 const candidates=[...near];if(!candidates.length)return null;
 // Even the easiest opponent takes a win and blocks an immediate loss.
 for(const mark of [2,1])for(const i of candidates){board[i]=mark;const win=winning(board,i).length;board[i]=0;if(win)return i;}
 const scored=candidates.map(i=>({i,score:value(board,i,2)+value(board,i,1)*(level>=4?1.12:.88)+Math.max(0,18-Math.abs(i%19-9)-Math.abs(Math.floor(i/19)-9))})).sort((a,b)=>b.score-a.score);
 if(level>=5){for(const c of scored.slice(0,8)){board[c.i]=2;let threat=0;for(const j of candidates)if(!board[j])threat=Math.max(threat,value(board,j,1));board[c.i]=0;c.score-=threat*(.12+(level-5)*.08);}scored.sort((a,b)=>b.score-a.score);}
 const pool=level===1?6:level===2?4:level===3?2:1;return scored[Math.min(scored.length-1,Math.floor(random()*pool))].i;
}
export const levelForRating=rating=>Math.max(1,Math.min(8,Math.floor((rating-700)/100)+1));
