import test from 'node:test';import assert from 'node:assert/strict';import {Miniflare} from 'miniflare';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
test('two players, spectator permissions, invitations, chat, result and account deletion',async()=>{
 const options={modules:true,scriptPath:'build/worker.js',compatibilityDate:'2026-08-06',durableObjects:{DIRECTORY:{className:'Directory',useSQLite:true},ROOM:{className:'Room',useSQLite:true}},bindings:{ALLOWED_ORIGINS:'http://localhost',GOOGLE_CLIENT_ID:'',ADMIN_USER_ID:''}};const mf=new Miniflare(options);
 const sockets=[];
 async function req(path,body,token,expected=200){const r=await mf.dispatchFetch('http://localhost/api'+path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const d=await r.json();assert.equal(r.status,expected,JSON.stringify(d));return d;}
 async function socket(id,token){const t=await req('/ticket',{room:id},token),r=await mf.dispatchFetch(`http://localhost/api/ws/room?room=${id}&ticket=${t.ticket}`,{headers:{Upgrade:'websocket'}});assert.equal(r.status,101);const ws=r.webSocket;ws.accept();sockets.push(ws);const messages=[];ws.addEventListener('message',e=>{if(e.data!=='pong')messages.push(JSON.parse(e.data));});await pause(40);return {ws,messages};}
 async function lobbySocket(token){const {ticket}=await req('/ticket',{room:'lobby'},token);const r=await mf.dispatchFetch('http://localhost/api/ws/lobby?ticket='+ticket,{headers:{Upgrade:'websocket'}});assert.equal(r.status,101);const ws=r.webSocket,messages=[];ws.accept();sockets.push(ws);ws.addEventListener('message',event=>{if(event.data!=='pong')messages.push(JSON.parse(event.data));});await pause(40);return {ws,messages};}
 async function act(id,token,action,extra={},expected=200){await pause(160);return req('/room/'+id+'/action',{action,...extra},token,expected);}
 try{
 const a=await req('/auth/register',{email:'alpha@example.com',password:'verysecure123',nickname:'Alpha',consent:true});
 await mf.setOptions({...options,bindings:{...options.bindings,ADMIN_USER_ID:a.user.id}});
 const lobbyA=await lobbySocket(a.token);
 const b=await req('/auth/register',{email:'beta@example.com',password:'verysecure123',nickname:'Beta',consent:true});
 const lobbyB=await lobbySocket(b.token);await pause(40);assert.ok(lobbyA.messages.filter(m=>m.type==='lobby').at(-1).users.some(u=>u.id===b.user.id&&!u.guest),'newly registered player appears in live presence');
 const c=await req('/auth/guest',{});
 await req('/auth/register',{email:'other@example.com',password:'verysecure123',nickname:'alpha',consent:true},null,400);
 await req('/auth/login',{email:'alpha@example.com',password:'wrongwrong1'},null,401);
 const login=await req('/auth/login',{email:'alpha@example.com',password:'verysecure123'});assert.equal(login.user.id,a.user.id);
 const {id}=await req('/rooms',{closed:true},a.token);
 const secondRoom=await req('/rooms',{closed:false},b.token);assert.notEqual(secondRoom.id,id);assert.equal((await req('/lobby',undefined,a.token)).rooms.length,2,'different players can own simultaneous tables');await act(secondRoom.id,b.token,'leave');
 await act(id,a.token,'invite',{target:b.user.id});await pause(30);assert.ok(lobbyB.messages.some(m=>m.type==='invitation'&&m.room===id));await act(id,a.token,'cancelInvite');
 await req('/room/'+id+'/join',{},b.token,403);
 const link=await act(id,a.token,'link');await req('/room/'+id+'/join',{invite:link.token},b.token);
 const sa=await socket(id,a.token),sb=await socket(id,b.token);
 await act(id,a.token,'closed');const sc=await socket(id,c.token);
 await act(id,c.token,'move',{index:180},403);
 await act(id,c.token,'chat',{text:'Ahoj <script>!'});
 await act(id,a.token,'chatLock');await act(id,c.token,'chat',{text:'Zamčeno'},403);
 await act(id,a.token,'closed');await pause(30);assert.ok(sc.messages.some(m=>m.type==='kicked'));
 await act(id,a.token,'ready');await act(id,b.token,'ready');await pause(30);
 let state=sa.messages.filter(m=>m.type==='state').at(-1).room;assert.equal(state.game.status,'playing');assert.equal(state.game.board.length,361);
 const first=state.game.turn===0?a:b,second=first===a?b:a;
 await act(id,second.token,'move',{index:180},400);await act(id,first.token,'move',{index:180});await act(id,second.token,'move',{index:180},400);
 await act(id,second.token,'draw');await act(id,first.token,'drawReply',{accept:false});
 for(let x=0;x<4;x++){await act(id,second.token,'move',{index:20+x});await act(id,first.token,'move',{index:181+x});}
 state=sa.messages.filter(m=>m.type==='state').at(-1).room;assert.equal(state.game.status,'finished');assert.equal(state.game.winner,first.user.id);assert.equal(state.game.board.some(Boolean),false);assert.ok(sa.messages.some(m=>m.type==='final'&&m.win.length===5));
 let leaderboard=await req('/leaderboard',undefined,a.token);assert.equal(leaderboard.find(u=>u.id===first.user.id).rating,1016);assert.equal(leaderboard.find(u=>u.id===second.user.id).rating,984);
 await act(id,a.token,'rematch');await act(id,b.token,'rematchReply',{accept:true});state=sa.messages.filter(m=>m.type==='state').at(-1).room;assert.equal(state.game.first,1-(first===a?0:1));
 await act(id,a.token,'resign');await act(id,b.token,'report',{description:'Test důkazu',target:a.user.id});const reports=await req('/admin',{action:'list'},a.token);assert.equal(reports.reports.length,1);assert.equal(reports.reports[0].messages.length,1);
 await req('/admin',{action:'list'},b.token,403);
 await act(id,a.token,'leave');await act(id,b.token,'leave');await req('/account',{action:'delete'},b.token);await req('/me',undefined,b.token,401);
 leaderboard=await req('/leaderboard',undefined,a.token);assert.equal(leaderboard.some(u=>u.id===b.user.id),false);
 }finally{for(const ws of sockets)try{ws.close();}catch{}await mf.dispose();}
});
