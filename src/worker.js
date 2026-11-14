import {DurableObject} from 'cloudflare:workers';
import {chooseTableName} from './table-names.js';
import {newGame,move,disconnect,reconnect,elo,TURN} from './game.js';
const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
const fail=(text,status=400)=>{throw Object.assign(Error(text),{status});};
const uid=()=>crypto.randomUUID();
const clean=s=>String(s||'').replace(/[\u0000-\u001f<>]/g,'').trim();
const nick=s=>{s=clean(s);if(!/^[\p{L}\p{N}_ .-]{3,24}$/u.test(s)||/^host\b/i.test(s))fail('Přezdívka musí mít 3–24 znaků a nesmí začínat „Host“.');return s;};
const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
const hash=async s=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
async function password(s,salt){if(typeof s!=='string'||s.length<10||s.length>200)fail('Heslo musí mít 10–200 znaků.');const k=await crypto.subtle.importKey('raw',new TextEncoder().encode(s),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:100000},k,256));}
const publicUser=u=>({id:u.id,nickname:u.nickname,guest:u.guest,rating:u.rating,wins:u.wins||0,losses:u.losses||0,draws:u.draws||0,admin:!!u.admin,warning:u.warning||null});
class Stored extends DurableObject{
 constructor(ctx,env){super(ctx,env);ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS records (key TEXT PRIMARY KEY, value TEXT NOT NULL)');}
 read(key,fallback=null){const r=this.ctx.storage.sql.exec('SELECT value FROM records WHERE key=?',key).toArray()[0];return r?JSON.parse(r.value):fallback;}
 write(key,value){this.ctx.storage.sql.exec('INSERT OR REPLACE INTO records VALUES (?,?)',key,JSON.stringify(value));}
 remove(key){this.ctx.storage.sql.exec('DELETE FROM records WHERE key=?',key);}
 all(prefix){return this.ctx.storage.sql.exec('SELECT key,value FROM records WHERE key LIKE ?',prefix+'%').toArray().map(r=>({key:r.key,...JSON.parse(r.value)}));}
 send(ws,data){try{ws.send(JSON.stringify(data));}catch{}}
}
export class Directory extends Stored{
 constructor(ctx,env){super(ctx,env);ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS identities (kind TEXT, identity TEXT, user_id TEXT, PRIMARY KEY(kind,identity))');ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));}
 rate(key,limit=20,period=60000){let r=this.read('rate:'+key,{n:0,until:0});if(r.until<Date.now())r={n:0,until:Date.now()+period};if(++r.n>limit)fail('Příliš mnoho požadavků. Zkuste to později.',429);this.write('rate:'+key,r);}
 user(id){return this.read('user:'+id);}
 active(u){if(!u)fail('Přihlaste se znovu.',401);if(u.bannedUntil>Date.now())fail('Tento účet má zakázaný přístup.',403);return u;}
 async auth(token){if(!token)fail('Přihlaste se.',401);const s=this.read('session:'+await hash(token));if(!s||s.until<Date.now())fail('Přihlaste se znovu.',401);return this.active(this.user(s.id));}
 async session(u){const token=uid()+uid();this.write('session:'+await hash(token),{id:u.id,until:Date.now()+30*86400000});this.ctx.waitUntil((async()=>{if(!await this.ctx.storage.getAlarm())await this.ctx.storage.setAlarm(Date.now()+60000);})());return {token,user:publicUser(u)};}
 async authenticate(kind,data,ip){
  this.rate('auth:'+ip,12);
  if(kind==='guest'){const id=uid(),u={id,nickname:'Host '+id.slice(0,8),guest:true,rating:1000,created:Date.now()};this.write('user:'+id,u);return this.session(u);}
  const email=String(data.email||'').trim().toLowerCase();
  if(kind==='register'){
   if(!data.consent)fail('Potvrďte zásady ochrany údajů.');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)fail('Zadejte platný e-mail.');
   const nickname=nick(data.nickname),salt=uid(),pw=await password(data.password,salt),id=uid();
   const u={id,nickname,email,salt,pw,guest:false,rating:1000,created:Date.now(),consentAt:Date.now()};
   try{this.ctx.storage.transactionSync(()=>{this.ctx.storage.sql.exec('INSERT INTO identities VALUES (?,?,?)','email',email,id);this.ctx.storage.sql.exec('INSERT INTO identities VALUES (?,?,?)','nick',nickname.toLocaleLowerCase('cs'),id);this.write('user:'+id,u);});}catch{fail('E-mail nebo přezdívka už existuje.');}return this.session(u);
  }
  if(kind==='login'){
   const row=this.ctx.storage.sql.exec('SELECT user_id FROM identities WHERE kind=? AND identity=?','email',email).toArray()[0];
   const u=row&&this.user(row.user_id),salt=u?.salt||uid(),pw=await password(data.password,salt);
   if(!u?.pw||pw!==u.pw)fail('Nesprávný e-mail nebo heslo.',401);this.active(u);return this.session(u);
  }
  if(kind==='google'){
   if(!this.env.GOOGLE_CLIENT_ID)fail('Přihlášení Google zatím není nastaveno.',503);
   const r=await fetch('https://oauth2.googleapis.com/tokeninfo?id_token='+encodeURIComponent(data.credential||''));const t=await r.json();
   if(!r.ok||t.aud!==this.env.GOOGLE_CLIENT_ID||!['accounts.google.com','https://accounts.google.com'].includes(t.iss)||Number(t.exp)*1000<Date.now()||String(t.email_verified)!=='true')fail('Neplatné přihlášení Google.',401);
   let row=this.ctx.storage.sql.exec('SELECT user_id FROM identities WHERE kind=? AND identity=?','google',t.sub).toArray()[0];
   if(row)return this.session(this.active(this.user(row.user_id)));
   if(!data.consent)fail('Pro založení účtu potvrďte zásady ochrany údajů.');
   const nickname=nick(data.nickname),id=uid(),u={id,nickname,email:t.email,guest:false,rating:1000,created:Date.now(),consentAt:Date.now()};
   try{this.ctx.storage.transactionSync(()=>{this.ctx.storage.sql.exec('INSERT INTO identities VALUES (?,?,?)','google',t.sub,id);this.ctx.storage.sql.exec('INSERT INTO identities VALUES (?,?,?)','email',t.email.toLowerCase(),id);this.ctx.storage.sql.exec('INSERT INTO identities VALUES (?,?,?)','nick',nickname.toLocaleLowerCase('cs'),id);this.write('user:'+id,u);});}catch{fail('E-mail nebo přezdívka již existuje. Přihlaste se původním způsobem.');}return this.session(u);
  }
  if(kind==='forgot'){
   if(!this.env.RESEND_API_KEY||!this.env.MAIL_FROM)fail('Obnova hesla čeká na nastavení odesílání e-mailů.',503);
   const row=this.ctx.storage.sql.exec('SELECT user_id FROM identities WHERE kind=? AND identity=?','email',email).toArray()[0];
   if(row){const token=uid()+uid();this.write('reset:'+await hash(token),{id:row.user_id,until:Date.now()+1800000});const url=this.env.PUBLIC_URL+'?reset='+encodeURIComponent(token);const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+this.env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:this.env.MAIL_FROM,to:email,subject:'Piškvorky – obnova hesla',text:'Nové heslo nastavíte do 30 minut: '+url})});if(!r.ok)fail('E-mail se nepodařilo odeslat.',503);}return {ok:true};
  }
  if(kind==='reset'){
   const key='reset:'+await hash(data.reset),s=this.read(key);if(!s||s.until<Date.now())fail('Odkaz už není platný.');const u=this.user(s.id),salt=uid(),pw=await password(data.password,salt);
   this.remove(key);u.salt=salt;u.pw=pw;this.write('user:'+u.id,u);this.revoke(u.id);return {ok:true};
  }fail('Neznámá operace.');
 }
 revoke(id){for(const s of this.all('session:'))if(s.id===id)this.remove(s.key);for(const ws of this.ctx.getWebSockets(id))ws.close(4001,'Přihlaste se znovu');}
 async account(u,data){
  if(data.action==='rename'){const name=nick(data.nickname);if(name===u.nickname)return {user:publicUser(u)};this.ctx.storage.transactionSync(()=>{try{this.ctx.storage.sql.exec('INSERT INTO identities VALUES (?,?,?)','nick',name.toLocaleLowerCase('cs'),u.id);}catch{fail('Přezdívka je obsazená.');}this.ctx.storage.sql.exec('DELETE FROM identities WHERE kind=? AND identity=?','nick',u.nickname.toLocaleLowerCase('cs'));u.nickname=name;this.write('user:'+u.id,u);});}
  if(data.action==='delete'){const busy=this.read('busy:'+u.id);if(busy)fail('Nejdříve opusťte místnost.');this.revoke(u.id);this.ctx.storage.sql.exec('DELETE FROM identities WHERE user_id=?',u.id);this.remove('user:'+u.id);this.forgetMatchups(u.id);for(const s of this.all('reset:'))if(s.id===u.id)this.remove(s.key);}
  if(data.action==='logout')this.revoke(u.id);
  if(data.action==='ignore'){u.ignored=[...new Set([...(u.ignored||[]),data.user])].slice(-200);this.write('user:'+u.id,u);}
  this.broadcast();return {user:data.action==='delete'?null:publicUser(u)};
 }
 leaderboard(){return this.all('user:').filter(u=>!u.guest).map(publicUser).sort((a,b)=>b.rating-a.rating||a.nickname.localeCompare(b.nickname)).slice(0,200);}
 presence(){return [...new Set(this.ctx.getWebSockets().filter(w=>w.readyState===1).map(w=>w.deserializeAttachment()?.id))].map(id=>this.user(id)).filter(u=>u&&!(u.bannedUntil>Date.now())).map(u=>({...publicUser(u),room:this.read('busy:'+u.id)?.room||null}));}
 lobby(){return {type:'lobby',rooms:this.all('room:').map(({key,...r})=>r),users:this.presence(),now:Date.now()};}
 broadcast(){const d=this.lobby();for(const ws of this.ctx.getWebSockets())this.send(ws,d);}
 notify(id,data){for(const ws of this.ctx.getWebSockets(id))this.send(ws,data);}
 roomName(id){
  const key='room-name:'+id,existing=this.read(key);if(existing)return existing.name;
  const used=new Set([...this.all('room:'),...this.all('room-name:')].map(record=>record.name));
  const name=chooseTableName(used);this.write(key,{name,until:Date.now()+120000});return name;
 }
 claim(id,room){const busy=this.read('busy:'+id);if(busy&&busy.room!==room)fail('Hráč je zaneprázdněn.');this.write('busy:'+id,{room});}
 release(id,room){if(this.read('busy:'+id)?.room===room)this.remove('busy:'+id);}
 updateRoom(room){if(room.deleted){this.remove('room:'+room.id);this.remove('room-name:'+room.id);}else this.write('room:'+room.id,room);this.broadcast();}
 checkInvite(from,target){const u=this.active(this.user(target));if(u.ignored?.includes(from))fail('Tento hráč nepřijímá vaše pozvánky.');if(this.read('busy:'+target))fail('Hráč je zaneprázdněn.');if(!this.ctx.getWebSockets(target).some(w=>w.readyState===1))fail('Hráč už není online.');return publicUser(u);}
 pairKey(players){return 'pair:'+players.slice().sort().join(':');}
 forgetMatchups(id){for(const pair of this.all('pair:'))if(pair.players.includes(id))this.remove(pair.key);}
 matchup(players){
  const pair=this.read(this.pairKey(players)),wins=players.map(id=>pair?pair.wins[pair.players.indexOf(id)]:0),draws=pair?.draws||0;
  return {users:players.map(id=>this.user(id)).map(user=>user?publicUser(user):null),headToHead:{players:[...players],wins,draws,games:wins[0]+wins[1]+draws}};
 }
 result(id,players,winner,annulled){
  if(this.read('result:'+id))return;this.ctx.storage.transactionSync(()=>{
   this.write('result:'+id,{at:Date.now()});if(annulled)return;
   const a=this.user(players[0]),b=this.user(players[1]);if(!a||!b)return;
   const key=this.pairKey(players),pair=this.read(key,{players:players.slice().sort(),wins:[0,0],draws:0});if(winner===null)pair.draws++;else pair.wins[pair.players.indexOf(winner)]++;this.write(key,pair);
   for(const u of [a,b]){if(!u.guest){const field=winner===null?'draws':winner===u.id?'wins':'losses';u[field]=(u[field]||0)+1;}}
   if(!a.guest&&!b.guest){const ratings=elo(a.rating,b.rating,winner===null?.5:winner===a.id?1:0);a.rating=ratings[0];b.rating=ratings[1];}
   this.write('user:'+a.id,a);this.write('user:'+b.id,b);
  });
 }
 async ticket(u,room){const ticket=uid();this.write('ticket:'+ticket,{id:u.id,room,until:Date.now()+30000});return {ticket};}
 consume(ticket,room){const s=this.read('ticket:'+ticket);this.remove('ticket:'+ticket);if(!s||s.until<Date.now()||s.room!==room)fail('Spojení vypršelo.',401);return this.active(this.user(s.id));}
 async fetch(request){const url=new URL(request.url),u=this.consume(url.searchParams.get('ticket'),'lobby');const pair=new WebSocketPair();this.ctx.acceptWebSocket(pair[1],[u.id]);pair[1].serializeAttachment({id:u.id});this.broadcast();return new Response(null,{status:101,webSocket:pair[0]});}
 webSocketMessage(ws,msg){if(msg!=='ping')ws.close(1008,'Nepodporovaná zpráva');}
 webSocketClose(){this.broadcast();}
 webSocketError(){this.broadcast();}
 report(u,room,description,messages,target){this.rate('report:'+u.id,3,600000);const id=uid();this.write('report:'+id,{id,by:u.id,room,target,description:clean(description).slice(0,1000),messages,at:Date.now(),until:Date.now()+172800000,status:'new'});this.ctx.storage.setAlarm(Date.now()+60000);return {ok:true};}
 admin(u,data){if(!this.env.ADMIN_USER_ID||u.id!==this.env.ADMIN_USER_ID)fail('Pouze administrátor.',403);if(data.action==='list')return {reports:this.all('report:').filter(r=>r.until>Date.now())};
  if(data.action==='resolve'){const r=this.read('report:'+data.id);if(r){r.status='resolved';this.write('report:'+data.id,r);}return {ok:true};}
  const target=this.user(data.target);if(!target)fail('Hráč již neexistuje.');
  if(data.action==='warn')target.warning=clean(data.message).slice(0,300)||'Administrátor vás upozorňuje na nevhodné chování.';
  else if(data.action==='mute')target.mutedUntil=Date.now()+Math.min(172800,Math.max(60,Number(data.seconds)||3600))*1000;
  else if(data.action==='ban'){target.bannedUntil=data.permanent?8640000000000000:Date.now()+Math.min(31536000,Math.max(60,Number(data.seconds)||86400))*1000;this.revoke(target.id);}
  else fail('Neznámý postih.');this.write('user:'+target.id,target);this.notify(target.id,{type:'warning',text:target.warning||'Administrátor upravil váš přístup.'});return {ok:true};
 }
 async alarm(){const now=Date.now();for(const prefix of ['rate:','ticket:','reset:','session:','report:'])for(const r of this.all(prefix))if(r.until<=now)this.remove(r.key);for(const u of this.all('user:'))if(u.guest&&u.created<now-30*86400000&&!this.read('busy:'+u.id)){this.revoke(u.id);this.remove(u.key);this.forgetMatchups(u.id);}for(const reservation of this.all('room-name:'))if(reservation.until<=now&&!this.read('room:'+reservation.key.slice('room-name:'.length)))this.remove(reservation.key);const reports=this.all('report:').map(r=>r.until).filter(t=>t>now);await this.ctx.storage.setAlarm(Math.min(now+3600000,...reports));}
}
export class Room extends Stored{
 constructor(ctx,env){super(ctx,env);ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));}
 directory(){return this.env.DIRECTORY.getByName('lobby');}
 state(){return this.read('state');}
 save(s){this.write('state',s);}
 player(s,u){return s.players.findIndex(p=>p?.id===u.id);}
 summary(s){return {id:s.id,name:s.name,players:s.players.map(p=>p?{id:p.id,nickname:p.nickname}:null),status:s.game?.status==='playing'?'playing':s.game?.status==='finished'?'finished':s.players.filter(Boolean).length===2?'ready':'waiting',closed:s.closed,invite:s.invite?{nickname:s.invite.nickname,until:s.invite.until}:null};}
 view(s){const {invite,link,...v}=s;return {...v,invite:invite?{id:invite.id,target:invite.target,nickname:invite.nickname,until:invite.until}:null,now:Date.now()};}
 async flush(){let s=this.state();if(!s)return;
  if(s.expiredPlayers?.length){const expired=s.expiredPlayers;delete s.expiredPlayers;this.save(s);for(const id of expired)await this.directory().release(id,s.id);s=this.state();}
  if(s.pendingResult){
   const result=s.pendingResult;
   await this.directory().result(result.id,result.players,result.winner,result.annulled);
   const snapshot=await this.directory().matchup(result.players);
   s=this.state();if(s.pendingResult?.id===result.id){
    if(s.players.every((player,index)=>player?.id===result.players[index])){
     s.ratingChanges={gameId:result.id,changes:s.players.map((player,index)=>(snapshot.users[index]?.rating??player.rating)-player.rating)};
     s.players=snapshot.users.map((player,index)=>player||s.players[index]);s.headToHead=snapshot.headToHead;
    }
    delete s.pendingResult;this.save(s);
   }
  }
  const playerIds=s.players.filter(Boolean).map(player=>player.id);
  if(playerIds.length===2&&JSON.stringify(s.headToHead?.players)!==JSON.stringify(playerIds)){
   const snapshot=await this.directory().matchup(playerIds);s=this.state();
   if(s.players.every((player,index)=>player?.id===playerIds[index])){s.players=snapshot.users.map((player,index)=>player||s.players[index]);s.headToHead=snapshot.headToHead;this.save(s);}
  }else if(playerIds.length<2&&s.headToHead){delete s.headToHead;delete s.ratingChanges;this.save(s);}
  await this.directory().updateRoom(s.players.some(Boolean)?this.summary(s):{id:s.id,deleted:true});
  for(const ws of this.ctx.getWebSockets()){const a=ws.deserializeAttachment();if(s.closed&&!s.players.some(p=>p?.id===a?.id)){this.send(ws,{type:'kicked',text:'Místnost byla uzavřena.'});ws.close(4003,'Uzavřená místnost');}else this.send(ws,{type:'state',room:this.view(s)});}
  await this.schedule(s);
 }
 async schedule(s){const times=[];if(s.game?.status==='playing'){times.push(...Object.values(s.game.disconnected).map(v=>v.until));if(!s.game.paused)times.push(s.game.deadline);}
  for(const v of [s.readyUntil,s.invite?.until,s.link?.until,s.game?.draw?.until,s.game?.rematch?.until,s.cleanupAt])if(v)times.push(v);
  if(s.pendingResult)times.push(Date.now()+1000);if(times.length)await this.ctx.storage.setAlarm(Math.max(Date.now()+50,Math.min(...times)));else await this.ctx.storage.deleteAlarm();
 }
 finish(s,result){if(s.game?.status!=='playing')return;const g=s.game;g.status='finished';g.finishedAt=Date.now();g.winner=result.winner;g.reason=result.reason;g.annulled=!!result.annulled;g.draw=null;g.deadline=null;g.disconnected={};g.paused=false;
  s.cleanupAt=Date.now()+60000;s.pendingResult={id:g.id,players:g.players,winner:result.winner,annulled:!!result.annulled};
  // Completed positions are sent once but are never retained in durable storage.
  g.board=Array(361).fill(0);g.last=null;g.win=[];s.ready=[false,false];
 }
 expire(s,now=Date.now()){
  if(s.invite?.until<=now)s.invite=null;if(s.link?.until<=now)s.link=null;
  if(s.readyUntil&&s.readyUntil<=now){s.readyUntil=null;const departing=s.players.map((p,i)=>p&&!s.ready[i]?p.id:null).filter(Boolean);s.expiredPlayers=[...(s.expiredPlayers||[]),...departing];s.players=s.players.map((p,i)=>s.ready[i]?p:null);s.ready=[false,false];}
  const g=s.game;if(g?.draw?.until<=now)g.draw=null;if(g?.rematch?.until<=now)g.rematch=null;
  if(g?.status==='playing'){
   const late=Object.entries(g.disconnected).filter(([,v])=>v.until<=now).sort((a,b)=>a[1].until-b[1].until)[0];
   if(!g.paused&&g.deadline<=now&&(!late||g.deadline<=late[1].until))this.finish(s,{winner:g.players[1-g.turn],reason:'čas'});
   else if(late)this.finish(s,{winner:g.players.find(p=>p!==late[0]),reason:'odpojení'});
   else if(!g.paused&&g.deadline<=now)this.finish(s,{winner:g.players[1-g.turn],reason:'čas'});
  }
 }
 async init(u,id,closed){await this.directory().claim(u.id,id);if(this.state())fail('Místnost již existuje.');const name=await this.directory().roomName(id);const s={id,name,players:[publicUser(u),null],ready:[false,false],closed:!!closed,chatLocked:false,chat:[],game:null,created:Date.now(),cleanupAt:Date.now()+60000};this.save(s);await this.flush();return {id};}
 async join(u,invite){let s=this.state();if(!s)fail('Stůl již neexistuje.',404);this.expire(s);this.save(s);
  if(this.player(s,u)>=0)return {id:s.id};
  if(s.game?.status==='playing'||s.players.filter(Boolean).length===2)fail('Obě místa jsou obsazená.');
  const linkOK=s.link&&s.link.token===invite&&s.link.until>Date.now();const invited=s.invite?.target===u.id;
  if(s.closed&&!invited&&!linkOK)fail('Do uzavřené místnosti potřebujete pozvánku.',403);
  if(s.invite&&!invited)fail('Místo je rezervované pro pozvaného hráče.');
  await this.directory().claim(u.id,s.id);
  s=this.state();this.expire(s);if(s.players.filter(Boolean).length===2||s.game?.status==='playing'){await this.directory().release(u.id,s.id);fail('Místo právě obsadil jiný hráč.');}
  if(s.closed&&!(s.link&&s.link.token===invite&&s.link.until>Date.now())&&s.invite?.target!==u.id){await this.directory().release(u.id,s.id);fail('Pozvánka vypršela.');}
  const i=s.players[0]?1:0;s.players[i]=publicUser(u);s.invite=null;s.link=null;s.ready=[false,false];s.readyUntil=Date.now()+60000;s.cleanupAt=null;s.game=null;this.save(s);await this.flush();return {id:s.id};
 }
 async action(u,data){let s=this.state();if(!s)fail('Stůl již neexistuje.',404);this.expire(s);this.save(s);const i=this.player(s,u),g=s.game;const a=data.action;
  if(s.closed&&i<0)fail('Místnost je uzavřená.',403);
  if(a==='report')return this.directory().report(u,s.id,data.description,s.chat.slice(-50),data.target);
  if(a==='chat'){
   if(s.closed&&i<0||s.chatLocked&&i<0)fail('Psaní diváků je uzamčené.',403);if(u.mutedUntil>Date.now())fail('Máte dočasně zablokovaný chat.',403);
   const t=clean(data.text).slice(0,300).replace(/\b(kurva|píča|pica|kokot|čurák|curak|fuck)\b/giu,'•••');if(!t)fail('Napište zprávu.');
   const last=this.read('chat:'+u.id,0);if(Date.now()-last<1000)fail('Odesílejte nejvýše jednu zprávu za sekundu.',429);this.write('chat:'+u.id,Date.now());s.chat.push({id:uid(),user:u.id,nickname:u.nickname,text:t,at:Date.now()});s.chat=s.chat.slice(-100);
  }else{
   if(i<0)fail('Tuto akci mohou provést pouze hráči.',403);
   const last=this.read('action:'+u.id,0);if(Date.now()-last<150)fail('Příliš rychlé ovládání.',429);this.write('action:'+u.id,Date.now());
   if(a==='ready'){
    if(s.players.filter(Boolean).length!==2||g?.status==='playing')fail('Čekáme na druhého hráče.');s.ready[i]=true;
    if(s.ready.every(Boolean)){s.game=newGame(s.players.map(p=>p.id),crypto.getRandomValues(new Uint8Array(1))[0]%2);s.readyUntil=null;}
   }else if(a==='move'){
    if(!g)fail('Partie ještě nezačala.');const result=move(g,u.id,data.index);if(result){const final={board:g.board.slice(),win:g.win.slice(),last:g.last};this.finish(s,result);for(const ws of this.ctx.getWebSockets())this.send(ws,{type:'final',...final});}
   }else if(a==='resign'){if(g?.status!=='playing')fail('Partie neprobíhá.');this.finish(s,{winner:s.players[1-i].id,reason:'vzdání'});}
   else if(a==='leave'){
    if(g?.status==='playing')this.finish(s,{winner:s.players[1-i].id,reason:'vzdání'});s.players[i]=null;s.ready=[false,false];s.readyUntil=null;s.closed=false;s.invite=null;s.link=null;s.game=null;this.save(s);await this.directory().release(u.id,s.id);s=this.state();
   }else if(a==='closed')s.closed=!s.closed;
   else if(a==='chatLock')s.chatLocked=!s.chatLocked;
   else if(a==='draw'){
    if(g?.status!=='playing')fail('Partie neprobíhá.');if(g.draw)fail('Nabídka už čeká na odpověď.');if(g.drawCounts[i]>=2)fail('Remízu lze nabídnout pouze dvakrát.');g.drawCounts[i]++;g.draw={from:u.id,until:Date.now()+30000};
   }else if(a==='drawReply'){
    if(!g?.draw||g.draw.from===u.id)fail('Nabídka již není platná.');if(data.accept)this.finish(s,{winner:null,reason:'dohoda'});else g.draw=null;
   }else if(a==='rematch'){
    if(g?.status!=='finished'||s.players.filter(Boolean).length!==2)fail('Odveta není dostupná.');if(g.rematch)fail('Nabídka odvety už čeká.');g.rematch={from:u.id,until:Date.now()+30000};
   }else if(a==='rematchReply'){
    if(!g?.rematch||g.rematch.from===u.id||s.players.filter(Boolean).length!==2)fail('Nabídka již není platná.');if(data.accept){s.game=newGame(s.players.map(p=>p.id),1-g.first);s.ready=[true,true];}else g.rematch=null;
   }else if(a==='invite'){
    if(s.players.filter(Boolean).length===2||g?.status==='playing')fail('Stůl je obsazený.');const target=await this.directory().checkInvite(u.id,data.target);s=this.state();if(s.players.filter(Boolean).length===2)fail('Stůl je již obsazený.');s.invite={id:uid(),target:target.id,nickname:target.nickname,until:Date.now()+120000};this.save(s);await this.directory().notify(target.id,{type:'invitation',room:s.id,name:s.name,from:u.nickname,fromId:u.id,until:s.invite.until});
   }else if(a==='cancelInvite')s.invite=null;
   else if(a==='link'){if(s.players.filter(Boolean).length===2)fail('Stůl je obsazený.');s.link={token:uid(),until:Date.now()+120000};this.save(s);await this.flush();return {token:s.link.token,until:s.link.until};}
   else fail('Neznámá akce.');
  }
  if(!s.players.some(Boolean)){this.save(s);await this.flush();await this.ctx.storage.deleteAll();return {ok:true};}
  this.save(s);await this.flush();return {ok:true};
 }
 async decline(u){const s=this.state();if(s?.invite?.target===u.id){s.invite=null;this.save(s);await this.flush();}return {ok:true};}
 async fetch(request){const url=new URL(request.url),u=await this.directory().consume(url.searchParams.get('ticket'),url.searchParams.get('room'));let s=this.state();if(!s)fail('Stůl již neexistuje.',404);this.expire(s);
  if(s.closed&&this.player(s,u)<0)fail('Místnost je uzavřená.',403);
  if(this.ctx.getWebSockets().length>=102)fail('Místnost je plná.',429);
  const pair=new WebSocketPair();this.ctx.acceptWebSocket(pair[1],[u.id]);pair[1].serializeAttachment({id:u.id});
  if(s.game?.status==='playing'){const result=reconnect(s.game,u.id);if(result)this.finish(s,result);}
  if(this.player(s,u)>=0)s.cleanupAt=null;this.save(s);await this.flush();return new Response(null,{status:101,webSocket:pair[0]});
 }
 webSocketMessage(ws,msg){if(msg!=='ping')ws.close(1008,'Akce odesílejte přes API');}
 async webSocketClose(ws){const id=ws.deserializeAttachment()?.id;if(this.ctx.getWebSockets(id).some(w=>w!==ws&&w.readyState===1))return;let s=this.state();if(!s)return;this.expire(s);
  if(s.game?.status==='playing'&&s.game.players.includes(id)){const result=disconnect(s.game,id);if(result)this.finish(s,result);}
  else if(s.players.some(p=>p?.id===id))s.cleanupAt=Date.now()+60000;
  this.save(s);await this.flush();
 }
 async webSocketError(ws){ws.close(1011,'Chyba spojení');await this.webSocketClose(ws);}
 async alarm(){let s=this.state();if(!s)return;const g=s.game;if(g?.status==='playing'){const deadlines=[...Object.values(g.disconnected).map(d=>d.until),...(!g.paused?[g.deadline]:[])];if(deadlines.length&&Date.now()-Math.min(...deadlines)>90000)this.finish(s,{winner:null,reason:'výpadek služby',annulled:true});}this.expire(s);
  if(s.cleanupAt&&s.cleanupAt<=Date.now()&&s.game?.status!=='playing'){
   s.expiredPlayers=[...(s.expiredPlayers||[])];s.players=s.players.map(p=>{if(p&&!this.ctx.getWebSockets(p.id).some(w=>w.readyState===1)){s.expiredPlayers.push(p.id);return null;}return p;});s.cleanupAt=null;
  }
  const expired=s.expiredPlayers||[];delete s.expiredPlayers;this.save(s);for(const id of expired)await this.directory().release(id,s.id);
  await this.flush();s=this.state();if(!s.players.some(Boolean)){await this.ctx.storage.deleteAll();for(const w of this.ctx.getWebSockets()){this.send(w,{type:'kicked',text:'Stůl zanikl.'});w.close(1000,'Stůl zanikl');}}
 }
}
export default {
 async fetch(request,env){const url=new URL(request.url),origin=request.headers.get('Origin'),own=url.origin;const allowed=[own,...(env.ALLOWED_ORIGINS||'').split(','),'http://localhost:8787','http://127.0.0.1:8787'];
  if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
  if(origin&&!allowed.includes(origin))return json({error:'Nepovolený původ požadavku.'},403);
  const headers={'Access-Control-Allow-Origin':origin||own,'Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Vary':'Origin','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  try{
   const d=env.DIRECTORY.getByName('lobby');let result;
   if(url.pathname==='/api/config')result={googleClientId:env.GOOGLE_CLIENT_ID||'',passwordReset:!!(env.RESEND_API_KEY&&env.MAIL_FROM)};
   else if(url.pathname==='/api/health')result={ok:true,version:'1.0.0'};
   else if(url.pathname==='/api/ws/lobby')return await d.fetch(request);
   else if(url.pathname==='/api/ws/room')return await env.ROOM.getByName(url.searchParams.get('room')||'').fetch(request);
   else{
    if(Number(request.headers.get('Content-Length')||0)>8192)fail('Požadavek je příliš velký.',413);
    let raw='';if(request.method==='POST'){const reader=request.body?.getReader();const chunks=[];let size=0;if(reader){while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>8192){await reader.cancel();fail('Požadavek je příliš velký.',413);}chunks.push(part.value);}}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}raw=new TextDecoder().decode(bytes);}if(raw.length>8192)fail('Požadavek je příliš velký.',413);let data={};try{data=raw?JSON.parse(raw):{};}catch{fail('Neplatný požadavek.');}
    const authMatch=url.pathname.match(/^\/api\/auth\/(guest|register|login|google|forgot|reset)$/);
    if(authMatch){if(request.method!=='POST')fail('Použijte POST.',405);result=await d.authenticate(authMatch[1],data,request.headers.get('CF-Connecting-IP')||'local');}
    else{
     const u=await d.auth((request.headers.get('Authorization')||'').replace(/^Bearer /,''));
     if(url.pathname==='/api/me')result={user:publicUser(u),room:(await d.read('busy:'+u.id))?.room||null};
     else if(url.pathname==='/api/lobby')result=await d.lobby();
     else if(url.pathname==='/api/leaderboard')result=await d.leaderboard();
     else{
      if(request.method!=='POST')fail('Použijte POST.',405);
      if(url.pathname==='/api/account')result=await d.account(u,data);
      else if(url.pathname==='/api/ticket')result=await d.ticket(u,data.room||'lobby');
      else if(url.pathname==='/api/rooms'){await d.rate('create:'+u.id,5,60000);const id=uid();result=await env.ROOM.getByName(id).init(u,id,data.closed);}
      else if(url.pathname==='/api/admin')result=await d.admin(u,data);
      else if(/^\/api\/room\/[a-f0-9-]{36}\/(join|action|decline)$/.test(url.pathname)){
       const [,id,op]=url.pathname.match(/^\/api\/room\/([^/]+)\/([^/]+)$/);const room=env.ROOM.getByName(id);
       if(op==='join')result=await room.join(u,data.invite);else if(op==='decline')result=await room.decline(u);else result=await room.action(u,data);
      }else fail('Nenalezeno.',404);
     }
    }
   }
   return new Response(JSON.stringify(result),{headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
  }catch(e){console.error(JSON.stringify({event:'request_error',path:url.pathname,message:e.message}));return new Response(JSON.stringify({error:e.message||'Chyba serveru.'}),{status:e.status||400,headers:{...headers,'Content-Type':'application/json'}});}
 }
};
