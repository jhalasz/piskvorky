import {SIZE,winning} from './game.js?v=20261116-1';
export const cell=coordinate=>{const m=/^([A-S])(1[0-9]|[1-9])$/.exec(coordinate);if(!m)throw Error('Neplatná souřadnice.');return (Number(m[2])-1)*SIZE+m[1].charCodeAt(0)-65;};
export function position(crosses=[],circles=[]){const board=Array(SIZE*SIZE).fill(0);for(const [list,mark] of [[crosses,1],[circles,2]])for(const c of list){const i=cell(c);if(board[i])throw Error('Duplicitní pole.');board[i]=mark;}return board;}
// Original tactical exercises, not transcriptions of the unavailable VCPR diagrams.
export const PRESETS=[
 {id:'empty',name:'Volná hra – prázdná deska',board:position(),toMove:1,humanMark:1,description:'Začni vlastní partii, nebo přepni na rozestavení a připrav libovolnou pozici.',hint:'Buduj kameny, které spolupracují ve více směrech.'},
 {id:'gap',name:'1. Dokonči přerušenou řadu',board:position(['E8','F8','H8','I8'],['D8','J8','F6','J10']),toMove:1,humanMark:1,description:'Křížky na tahu. Najdi okamžitou výhru uvnitř řady.',hint:'Doplň G8. I řada s mezerou uprostřed může být čtyřkou.',solution:'G8'},
 {id:'defend',name:'2. Zastav soupeřovu čtyřku',board:position(['D8','G6','I6','J10'],['E8','F8','G8','H8']),toMove:1,humanMark:1,description:'Křížky na tahu. Nejprve odvratíš bezprostřední prohru; potom se hraje dál.',hint:'Zahraj I8. Vlastní pomalejší útok teď nepomůže.',solution:'I8'},
 {id:'double-four',name:'3. Dvojitá čtyřka',board:position(['E8','F8','G8','H5','H6','H7'],['D8','H4','B2','D3','F2','B5']),toMove:1,humanMark:1,description:'Křížky na tahu. Jedním tahem připrav dvě různá místa k dokončení pětice.',hint:'H8 vytvoří dvě čtyřky. Po obraně I8 vyhraješ na H9; po obraně H9 na I8.',solution:'H8'},
 {id:'four-three',name:'4. Čtyřka a otevřená trojka',board:position(['E8','F8','G8','H6','H7'],['D8','B2','D3','F2','B5']),toMove:1,humanMark:1,description:'Křížky na tahu. Vynucená obrana jedné řady ti dá čas dokončit druhý útok.',hint:'H8 vynutí I8. Pak H9 vytvoří otevřenou čtyřku H6–H9; vyhraješ na H5 nebo H10.',solution:'H8'},
 {id:'double-three',name:'5. Dvě otevřené trojky',board:position(['F8','G8','H6','H7'],['B2','D3','F2','B5']),toMove:1,humanMark:1,description:'Křížky na tahu. Najdi průsečík dvou útoků. Soupeř zde nemá rychlejší protiútok.',hint:'H8 vytvoří trojky F8–H8 a H6–H8. Rozviň tu, kterou soupeř nezablokuje, do otevřené čtyřky.',solution:'H8'},
 {id:'allis',name:'6. Allis – rozbor rozehraného zahájení',board:position(['H8','G7','I9','I8','F9','H9','G6'],['H7','F6','G8','I6','G9','H6']),toMove:2,humanMark:1,description:'Pozice po 13 tazích publikované partie. Na tahu jsou kolečka (počítač). Zkoumej pokračování za křížky na naší desce 19 × 19.',hint:'V publikované větvi následuje ○ J5, × K4. Pro jinou obranu je nutné hledat jiné pokračování. Počítač tuto větev nemusí zvolit.',source:'https://icga.org/icga/games/go-moku/'}
];
export function validatePosition(board,toMove,humanMark){
 if(!Array.isArray(board)||board.length!==SIZE*SIZE||board.some(v=>![0,1,2].includes(v)))throw Error('Pozice musí mít 19 × 19 polí se symboly × a ○.');
 if(![1,2].includes(toMove)||![1,2].includes(humanMark))throw Error('Vyber symbol na tahu a svůj symbol.');
 if(board.every(Boolean))throw Error('Deska je plná. Uvolni alespoň jedno pole.');
 if(board.some((v,i)=>v&&winning(board,i).length))throw Error('Pozice už obsahuje vítěznou řadu. Před tréninkem ji uprav.');
 return true;
}
export function makeTraining(preset,level=1){return {board:[...preset.board],toMove:preset.toMove,humanMark:preset.humanMark,turn:preset.toMove===preset.humanMark?0:1,last:null,win:[],level,finished:false,editing:true,brush:1,preset:preset.id,description:preset.description||'Vlastní cvičná pozice.',hint:preset.hint||'',source:preset.source||null};}
