import test from 'node:test';import assert from 'node:assert/strict';import {Miniflare} from 'miniflare';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
test('swap2 API persists opening, protects actors, updates lobby and rematches',async()=>{
 const mf=new Miniflare({modules:true,scriptPath:'build/worker.js',compatibilityDate:'2026-08-06',durableObjects:{DIRECTORY:{className:'Directory',useSQLite:true},ROOM:{className:'Room',useSQLite:true}},bindings:{ALLOWED_ORIGINS:'http://localhost'}});
 const sockets=[];let serial=0;
 async function req(path,body,token,expected=200){const r=await mf.dispatchFetch('http://localhost/api'+path,{method:body===undefined?'GET':'POST',headers:{'CF-Connecting-IP':'swap-'+ ++serial,...(token?{Authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});const d=await r.json();assert.equal(r.status,expected,JSON.stringify(d));return d;}
 async function connect(id,token){const {ticket}=await req('/ticket',{room:id},token),r=await mf.dispatchFetch(`http://localhost/api/ws/room?room=${id}&ticket=${ticket}`,{headers:{Upgrade:'websocket'}});assert.equal(r.status,101);const ws=r.webSocket;ws.accept();sockets.push(ws);const states=[];ws.addEventListener('message',e=>{if(e.data!=='pong'){const m=JSON.parse(e.data);if(m.type==='state')states.push(m.room);}});await pause(30);return {ws,states};}
 try{
 const a=await req('/auth/guest',{}),b=await req('/auth/guest',{}),c=await req('/auth/guest',{}),users=[a,b];
 await req('/rooms',{openingRule:'bogus'},a.token,400);
 const {id}=await req('/rooms',{openingRule:'swap2'},a.token);
 assert.equal((await req('/lobby',undefined,a.token)).rooms.find(r=>r.id===id).openingRule,'swap2');
 await req('/room/'+id+'/join',{},b.token);const sa=await connect(id,a.token),sb=await connect(id,b.token),sc=await connect(id,c.token);
 async function act(u,action,extra={},status=200){await pause(160);const r=await req('/room/'+id+'/action',{action,...extra},u.token,status);await pause(15);return r;}
 const state=()=>sa.states.at(-1);
 await act(c,'openingRule',{rule:'none'},403);await act(a,'ready');await act(b,'openingRule',{rule:'swap'});assert.deepEqual(state().ready,[false,false]);
 await act(a,'openingRule',{rule:'swap2'});await act(a,'ready');await act(b,'ready');
 const first=state().game.first,proposer=users[first],other=users[1-first];
 await act(other,'move',{index:180},400);await act(c,'openingChoice',{choice:1},403);
 for(const index of [180,181,200])await act(proposer,'move',{index});
 assert.equal(state().game.opening.phase,'choose');
 await act(proposer,'openingChoice',{choice:1},400);await act(other,'move',{index:201},400);
 await act(other,'openingRule',{rule:'none'},400);
 await act(other,'openingChoice',{choice:'extend'});await act(other,'move',{index:201});await act(other,'move',{index:202});
 assert.equal(state().game.opening.phase,'chooseFinal');
 // A fresh WebSocket receives the persisted decision phase and the five stones.
 const again=await connect(id,proposer.token);assert.equal(again.states.at(-1).game.opening.phase,'chooseFinal');assert.equal(again.states.at(-1).game.board.filter(Boolean).length,5);
 await act(proposer,'openingChoice',{choice:'extend'},400);await act(proposer,'openingChoice',{choice:2});
 assert.equal(state().game.turn,first);assert.equal(state().game.marks[first],2);assert.equal(sc.states.at(-1).game.marks[first],2);
 await act(proposer,'move',{index:203});assert.equal(state().game.board[203],2);
 await act(other,'resign');assert.equal(state().game.winner,proposer.user.id);
 await act(proposer,'rematch');await act(other,'rematchReply',{accept:true});assert.equal(state().game.first,1-first);assert.equal(state().game.opening.phase,'place3');assert.equal(state().game.openingRule,'swap2');assert.equal(state().game.board.some(Boolean),false);
 await act(a,'leave');await act(b,'leave');
 }finally{for(const ws of sockets)try{ws.close();}catch{}await pause(30);await mf.dispose();}
});
