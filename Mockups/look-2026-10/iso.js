// iso.js - model-town drawing helpers copied from round 2, look C (mock-ups only)
const INK='#2b2d42';
const shade=(hex,p)=>{let n=parseInt(hex.slice(1),16),r=n>>16,g=n>>8&255,b=n&255;const f=x=>Math.max(0,Math.min(255,Math.round(x+(p<0?x*p:(255-x)*p))));return '#'+[f(r),f(g),f(b)].map(v=>v.toString(16).padStart(2,'0')).join('')};
// isometric helpers: (a,b) on the ground, z up. Card-model look: matte faces, thin darker edges, no gloss.
const I=(x,y)=>(a,b,z)=>[x+(a-b)*.866,y+(a+b)*.5-z];
const poly=(pts,fill,edge,w=1.6)=>`<polygon points="${pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}" fill="${fill}" stroke="${edge}" stroke-width="${w}" stroke-linejoin="round"/>`;
function box(x,y,w,d,h,c,z0=0,top=true){const P=I(x,y),a=w/2,b=d/2,e=shade(c,-.4);
  return poly([P(-a,b,z0),P(a,b,z0),P(a,b,z0+h),P(-a,b,z0+h)],c,e)+poly([P(a,-b,z0),P(a,b,z0),P(a,b,z0+h),P(a,-b,z0+h)],shade(c,-.17),e)+(top?poly([P(-a,-b,z0+h),P(a,-b,z0+h),P(a,b,z0+h),P(-a,b,z0+h)],shade(c,.25),e):'')}
function wins(x,y,w,d,h,cols,rows,glass='#d6f0fb',z0=0){const P=I(x,y),a=w/2,b=d/2;let o='';
  for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){const u0=-a+(i+.25)*w/cols,u1=u0+.5*w/cols,z1=z0+(j+.3)*h/rows,z2=z1+.45*h/rows;o+=poly([P(u0,b,z1),P(u1,b,z1),P(u1,b,z2),P(u0,b,z2)],glass,'rgba(43,45,66,.45)',1.2)}
  for(let i=0;i<Math.max(1,cols-1);i++)for(let j=0;j<rows;j++){const v0=b-(i+.25)*d/Math.max(1,cols-1),v1=v0-.5*d/Math.max(1,cols-1),z1=z0+(j+.3)*h/rows,z2=z1+.45*h/rows;o+=poly([P(a,v0,z1),P(a,v1,z1),P(a,v1,z2),P(a,v0,z2)],shade(glass,-.12),'rgba(43,45,66,.45)',1.2)}
  return o}
const shadow=(x,y,w,d)=>{const P=I(x+14,y+4),a=w/2+4,b=d/2+4;return poly([P(-a,-b,0),P(a,-b,0),P(a,b,0),P(-a,b,0)],'rgba(43,45,66,.16)','none',0)};
const COL={finish:'#ffd84d',eng:'#ffb26b',arch:'#b892ff',dob:'#ff8a80',fire:'#ff5a4e',inv:'#7aa7ff',bank:'#4fd1b5'};
function building(id,x,y,c){ // returns {svg, top}
  let o='',P=I(x,y),top=0;
  if(id==='finish'){o+=shadow(x,y,74,74)+box(x,y,74,74,10,'#f2e6c9');[-30,30].forEach(a=>o+=box(x+(a)*.866,y+a*.5-0,6,6,58,'#ffffff',10));o+=`<path d="M${P(-30,0,52)[0]} ${P(-30,0,52)[1]}Q${x} ${y-30} ${P(30,0,52)[0]} ${P(30,0,52)[1]}" fill="none" stroke="#e5243b" stroke-width="7"/><circle cx="${x}" cy="${y-36}" r="8" fill="#e5243b"/>`;[...Array(6)].forEach((_,i)=>{const q=P(-30+i*12,0,66);o+=`<path d="M${q[0]} ${q[1]}l6 12l6 -12z" fill="${['#ff5a4e','#4fd1b5','#ffd84d','#7aa7ff','#b892ff','#ffb26b'][i]}"/>`});top=70}
  else if(id==='inv'){o+=shadow(x,y,58,58)+box(x,y,58,58,170,'#9fc2ff')+wins(x,y,58,58,170,3,7,'#e8f2ff');top=176}
  else if(id==='dob'||id==='bank'){const h=id==='dob'?82:72;o+=shadow(x,y,104,80)+box(x,y,104,80,8,shade(c,.2))+box(x,y,96,72,h-8,c,8);for(let i=0;i<5;i++){const u=-40+i*20;o+=poly([P(u-3,36,8),P(u+3,36,8),P(u+3,36,h-10),P(u-3,36,h-10)],'#ffffff','rgba(43,45,66,.35)',1)}
    o+=poly([P(-48,36,h),P(48,36,h),P(0,36,h+34)],shade(c,.35),shade(c,-.4))+box(x,y,96,72,6,shade(c,-.05),h);
    o+=`<text x="${P(0,36,h+12)[0]}" y="${P(0,36,h+12)[1]}" text-anchor="middle" font-size="18" font-weight="900" fill="${INK}">${id==='bank'?'$':'⌂'}</text>`;top=h+40}
  else if(id==='fire'){o+=shadow(x,y,84,66)+box(x,y,84,66,74,c)+wins(x,y,84,66,30,3,1,'#ffe1dc',44);for(let i=0;i<2;i++){const u=-34+i*38;o+=poly([P(u,33,0),P(u+30,33,0),P(u+30,33,38),P(u,33,38)],'#fff3e8','rgba(43,45,66,.4)',1.4)}top=80}
  else if(id==='arch'){o+=shadow(x,y,84,70)+box(x,y,84,70,70,c)+wins(x,y,84,70,70,3,2,'#efe6ff');const q=P(0,0,70);o+=`<path d="M${q[0]-30} ${q[1]-6}L${q[0]+30} ${q[1]-6}L${q[0]} ${q[1]-50}Z" fill="#ffd84d" stroke="${INK}" stroke-width="3"/><path d="M${q[0]-12} ${q[1]-14}L${q[0]+12} ${q[1]-14}L${q[0]} ${q[1]-32}Z" fill="${c}"/><path d="M${q[0]-40} ${q[1]-30}L${q[0]+36} ${q[1]-58}" stroke="#ff6b4a" stroke-width="8" stroke-linecap="round"/><path d="M${q[0]+36} ${q[1]-58}l8 -3" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>`;top=124}
  else if(id==='eng'){o+=shadow(x,y,80,70)+box(x,y,80,70,72,c)+wins(x,y,80,70,72,3,2,'#fff1e0');const q=P(0,0,72);o+=`<g transform="translate(${q[0]},${q[1]-26})"><circle r="17" fill="#fff" stroke="${INK}" stroke-width="3"/>${[0,45,90,135].map(a=>`<rect x="-4" y="-24" width="8" height="48" rx="2" fill="#fff" stroke="${INK}" stroke-width="2.5" transform="rotate(${a})"/>`).join('')}<circle r="12" fill="#fff"/><circle r="6" fill="${c}"/></g>`;top=124}
  return {svg:o,top};
}
function owner(x,y,c){const P=I(x,y),a=30,b=28,h=50,r=30;let o=shadow(x,y,60,56)+box(x,y,60,56,h,c,0,false);const e=shade(c,-.45);
  o+=poly([P(-a,0,h+r),P(a,0,h+r),P(a,b,h),P(-a,b,h)],shade(c,-.3),e)+poly([P(a,-b,h),P(a,b,h),P(a,0,h+r)],shade(c,-.1),e);
  o+=poly([P(-6,b,0),P(8,b,0),P(8,b,26),P(-6,b,26)],'#fff','rgba(43,45,66,.5)',1.2)+wins(x,y,60,56,h,2,1,'#fff7da',22);return {svg:o,top:h+r+8}}
function office(x,y,c){const P=I(x,y);let o=shadow(x,y,58,54)+box(x,y,58,54,82,c)+wins(x,y,58,54,82,2,3,'#ffffff');
  const t=P(10,-8,82);o+=`<g>${[[-5,0],[5,0]].map(([dx])=>`<rect x="${t[0]+dx-1.5}" y="${t[1]-14}" width="3" height="14" fill="#8a5a3c"/>`).join('')}<path d="M${t[0]-10} ${t[1]-14}h20v-14q-10 -8 -20 0z" fill="#c98b56" stroke="${INK}" stroke-width="2"/><path d="M${t[0]-12} ${t[1]-30}l12 -10l12 10z" fill="#8a5a3c" stroke="${INK}" stroke-width="2"/></g>`;return {svg:o,top:128}}
function site(kind,stage,c,x,y){const P=I(x,y);let o=poly([P(-38,-34,0),P(38,-34,0),P(38,34,0),P(-38,34,0)],'#d9b98c','#a8875e',1.4);
  if(kind==='reno'){o+=box(x,y,58,52,70,'#e8d9c2')+wins(x,y,58,52,70,2,3,stage>=4?'#cfeeff':'#cbbfae');const sh=12+stage*12;
    for(let i=0;i<=4;i++){const u=-32+i*16;o+=`<path d="M${P(u,30,0)[0]} ${P(u,30,0)[1]}V${P(u,30,sh)[1]}" stroke="#f0a020" stroke-width="3"/>`}
    for(let j=1;j<=3;j++){const z=j*sh/3;o+=`<path d="M${P(-32,30,z)[0]} ${P(-32,30,z)[1]}L${P(32,30,z)[0]} ${P(32,30,z)[1]}" stroke="#f0a020" stroke-width="3"/>`}
    o+=box(x+8,y+18,74,10,4,'#2fae5e',22);return {svg:o,top:80}}
  for(let i=0;i<9;i++){const u=-36+i*9;o+=`<path d="M${P(u,34,0)[0]} ${P(u,34,0)[1]}v-12" stroke="#ff9f1c" stroke-width="5" stroke-linecap="round"/>`}
  const crane=h=>{const m=P(26,-26,0),t=P(26,-26,h);return `<path d="M${m[0]} ${m[1]}V${t[1]}" stroke="#ffd23f" stroke-width="7"/><path d="M${t[0]-70} ${t[1]+10}L${t[0]+30} ${t[1]-6}" stroke="#ffd23f" stroke-width="6"/><path d="M${t[0]-50} ${t[1]+7}v30" stroke="${INK}" stroke-width="2"/>`};
  if(stage===2){o+=poly([P(-26,-22,0),P(20,-22,0),P(20,24,0),P(-26,24,0)],'#a07850','#7a5a3c')+crane(110);return {svg:o,top:96}}
  for(let f=0;f<3;f++)o+=box(x-2,y+2,56,52,3,'#c9cbd6',f*24+21);
  [[-26,24],[26,24],[26,-24],[-26,-24],[0,24]].forEach(([a,b])=>{const q=P(a,b,0),r=P(a,b,93);o+=`<path d="M${q[0]} ${q[1]}V${r[1]}" stroke="#9497a8" stroke-width="3"/>`});
  return {svg:o+crane(150),top:110}}
function tree(x,y,c='#5ccf7a'){return `<g><path d="M${x} ${y}v-22" stroke="#9a7653" stroke-width="4"/><circle cx="${x}" cy="${y-34}" r="16" fill="${c}"/><circle cx="${x-5}" cy="${y-39}" r="6" fill="#fff" opacity=".35"/></g>`}
function pawn(x,y,c,s=1){const d=shade(c,-.3);return `<g transform="translate(${x},${y}) scale(${s})"><ellipse cx="0" cy="0" rx="18" ry="7" fill="rgba(43,45,66,.25)"/><path d="M-16 0Q-16 -8 -10 -10L-8 -32Q-16 -36 -12 -44H12Q16 -36 8 -32L10 -10Q16 -8 16 0Z" fill="${c}" stroke="${d}" stroke-width="2.5"/><circle cx="0" cy="-58" r="15" fill="${c}" stroke="${d}" stroke-width="2.5"/><circle cx="-5" cy="-63" r="5" fill="#fff" opacity=".45"/></g>`}
function tag(x,y,txt,c,fs=25){const two=txt.length>14&&txt.includes(' ');const ls=two?[txt.slice(0,txt.indexOf(' ')),txt.slice(txt.indexOf(' ')+1)]:[txt];const w=Math.max(...ls.map(t=>t.length))*fs*.6+34,h=ls.length*fs*1.12+14;
  return `<g><rect x="${x-w/2}" y="${y-h+5}" width="${w}" height="${h}" rx="14" fill="rgba(43,45,66,.18)"/><rect x="${x-w/2}" y="${y-h}" width="${w}" height="${h}" rx="14" fill="#fff"/><rect x="${x-w/2}" y="${y-h}" width="10" height="${h}" rx="5" fill="${c}"/>${ls.map((t,i)=>`<text x="${x+5}" y="${y-h+7+fs*.98+i*fs*1.1}" text-anchor="middle" font-size="${fs}" font-weight="800" fill="${INK}">${t}</text>`).join('')}</g>`}
