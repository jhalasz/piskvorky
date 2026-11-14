// Short, readable Czech bird names. Numbers are used only after exhausting the list.
export const BIRDS=Object.freeze([
 'Albatros','Andulka','Ara','Bažant','Bekasina','Berneška','Brhlík','Brkoslav',
 'Břehouš','Břehule','Budníček','Bukáček','Bukač','Bělořit','Bělokur','Cvrčilka',
 'Chocholouš','Chřástal','Chřástalek','Čáp','Čečetka','Čejka','Červenka','Čírka',
 'Datel','Datlík','Dlask','Drozd','Dudek','Dytík','Flétňák','Havran',
 'Hohol','Holub','Holoubek','Hrdlička','Husa','Husice','Hýl','Ibis',
 'Jespák','Jeřáb','Jiřička','Kachna','Kakadu','Kalander','Kalous',
 'Kameňáček','Káně','Kavče','Kavka','Kivi','Kolibřík','Kolpík','Konipas',
 'Kopřivka','Kormorán','Koroptev','Kos','Krahujec','Králíček','Krkavec','Krutihlav',
 'Křepelka','Křivka','Kukačka','Kulík','Kulik','Kvakoš','Labuť',
 'Ledňáček','Lejsek','Lelek','Linduška','Lori','Luňák','Lyska','Lžičák',
 'Mandarínka','Morčák','Moták','Moudivláček','Nandu','Orebice','Orel','Orlík',
 'Orlovec','Ořešník','Ostralka','Ostříž','Páv','Papoušek','Pelikán',
 'Pěnice','Pěnkava','Piha','Pisík','Plameňák','Poštolka','Potápka',
 'Potáplice','Puštík','Pštros','Racek','Rákosník','Rehek','Rorýs','Rybák',
 'Sedmihlásek','Skalník','Skorec','Skřivan','Slavík','Slípka','Sluka','Sojka',
 'Sokol','Sova','Stehlík','Straka','Strakapoud','Strnad','Střízlík','Sup',
 'Sýc','Sýček','Sýkora','Šoupálek','Špaček','Tenkozobec','Terej','Tetřev',
 'Tetřívek','Ťuhýk','Tukan','Tučňák','Ústřičník','Včelojed','Vlaštovka','Vlha',
 'Vodouš','Volavka','Vrabec','Vrána','Výr','Zedníček','Zrzohlávka','Zvonek',
 'Zvonohlík','Žluna','Žluva'
]);
export function chooseTableName(used){
 const offset=crypto.getRandomValues(new Uint32Array(1))[0]%BIRDS.length;
 for(let suffix=1;;suffix++)for(let step=0;step<BIRDS.length;step++){
  const name='Stůl '+BIRDS[(offset+step)%BIRDS.length]+(suffix===1?'':' '+suffix);
  if(!used.has(name))return name;
 }
}
