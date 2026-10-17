(function(){
/* ===================================================================
   ChemCore: a small chemistry engine that works from principles.
   - Species database: composition, enthalpy and entropy of formation, colour, solubility
   - Automatic equation balancing (atoms + charge, null-space of the composition matrix)
   - Thermodynamics: dH, dS, dG(T), equilibrium constants (van't Hoff), reaction quotients
   - Aqueous equilibrium solver (water, weak acids, hydrolysis, solubility) by mass action
   - Redox generated from the database: any metal vs any oxidant, spontaneity from dG, rate from E
   - Kinetics: Arrhenius, surface area, mixing, light; gas partial pressures
   Adding new chemistry = adding data (a species or a reaction line), not code.
   =================================================================== */
const R_=8.314,F_=96485,TS=298.15;
const AW={H:1.008,C:12.011,N:14.007,O:15.999,Na:22.99,Mg:24.305,S:32.06,Cl:35.45,K:39.098,Ca:40.078,Fe:55.845,Cu:63.546,Zn:65.38,Br:79.904,Ag:107.87,I:126.9,Ba:137.33,Pb:207.2};
const sub=n=>String(n).split("").map(d=>"₀₁₂₃₄₅₆₇₈₉"[d]||d).join("");
const sup=s=>s.split("").map(ch=>({"0":"⁰","1":"¹","2":"²","3":"³","+":"⁺","-":"⁻"}[ch]||ch)).join("");
const add=(o,p,k)=>{for(const e in p)o[e]=(o[e]||0)+p[e]*(k||1);return o};
const clampv=(v,a,b)=>Math.max(a,Math.min(b,v));
/* ---------- formula parsing ---------- */
function parseGroup(s){let i=0;
 function grp(){const o={};
  while(i<s.length){const ch=s[i];
   if(ch==="("){i++;const inner=grp();i++;let n="";while(/\d/.test(s[i]||""))n+=s[i++];add(o,inner,n?+n:1)}
   else if(ch===")")return o;
   else{let el=ch;i++;while(/[a-z]/.test(s[i]||""))el+=s[i++];let n="";while(/\d/.test(s[i]||""))n+=s[i++];o[el]=(o[el]||0)+(n?+n:1)}}
  return o}
 return grp()}
function parseF(f){const out={};for(const part of f.split(".")){const m=part.match(/^(\d+)(.*)$/);add(out,parseGroup(m?m[2]:part),m?+m[1]:1)}return out}
function splitId(id){let ph=null,m=id.match(/\((s|l|g|aq)\)$/);if(m){ph=m[1];id=id.slice(0,-m[0].length)}
 let z=0,mm=id.match(/^(.+?)(?:\^(\d+))?([+-])$/);
 if(mm&&/[A-Za-z)0-9]$/.test(mm[1])){z=(mm[3]==="+"?1:-1)*(mm[2]?+mm[2]:1);id=mm[1]}
 return{base:id,ph:ph||"aq",z}}
/* ---------- species database ---------- */
const SP={};
function S(id,H,Sd,o){o=o||{};const q=splitId(id);const el=o.comp||parseF(q.base);
 const sp=Object.assign({id,base:q.base,ph:q.ph,z:q.z,el,H:H,S:Sd},o);
 let M=0;for(const e in el)M+=(AW[e]||0)*el[e];sp.M=M;SP[id]=sp;return sp}
const GRY="#9aa7b3";
/* metals */
S("Mg(s)",0,32.7,{lid:"mg",sc:"#d6dade",name:"Magnesium",kd:0});S("Zn(s)",0,41.6,{lid:"zn",sc:GRY,name:"Zinc"});
S("Fe(s)",0,27.3,{lid:"fe",sc:"#5d6168",name:"Iron"});S("FeNail(s)",0,27.3,{lid:"nail",sc:"#5d6168",name:"Iron nail",comp:{Fe:1}});
S("Cu(s)",0,33.2,{lid:"cu",sc:"#b8733a",name:"Copper"});S("Pb(s)",0,65.1,{sc:"#7a7a85",name:"Lead"});
S("Ag(s)",0,42.6,{lid:"ag",sc:"#6e7076",name:"Silver"});S("Na(s)",0,51.3,{lid:"na",sc:"#b9bdc4",name:"Sodium"});
/* oxides */
S("MgO(s)",-601.6,27.0,{lid:"mgo",sc:"#f4f4ee",name:"Magnesium oxide",born:"white powder of magnesium oxide forms",basic:1,nopp:1,kd:.02,kT:12,d:"MgO(s) + H2O(l) = Mg^2+ + 2OH-",ksp:1e-11});
S("CuO(s)",-157.3,42.6,{lid:"cuo",sc:"#1c1c1c",name:"Copper(II) oxide",born:"the red-brown copper turns black: copper(II) oxide forms",basic:1,nopp:1,kd:3e-4,kT:12,d:"CuO(s) + H2O(l) = Cu^2+ + 2OH-",ksp:2.2e-20});
S("ZnO(s)",-350.5,43.7,{lid:"zno",sc:"#f2f2ee",name:"Zinc oxide",basic:1,nopp:1,kd:.003,kT:12,d:"ZnO(s) + H2O(l) = Zn^2+ + 2OH-",ksp:3e-17});
S("CaO(s)",-634.9,38.1,{lid:"cao",sc:"#f4f1e8",name:"Calcium oxide (quicklime)",basic:1,nopp:1,kw:1,kd:.025,d:"CaO(s) + H2O(l) = Ca^2+ + 2OH-"});
S("Fe2O3(s)",-824.2,87.4,{lid:"fe2o3",sc:"#8a3b1c",name:"Iron(III) oxide",born:"the solid turns reddish-brown (iron(III) oxide)"});
S("PbO(s)",-217.3,68.7,{lid:"pbo",sc:"#e8b020",name:"Lead(II) oxide",born:"a yellow residue of lead(II) oxide is left behind"});
/* hydroxides and carbonate (precipitates) */
const P=(id,H,Sd,o)=>S(id,H,Sd,Object.assign({ppt:1,basic:1,kd:.05},o));
P("Mg(OH)2(s)",-924.5,63.2,{sc:"#f6f6f6",cw:"white",name:"Magnesium hydroxide",ksp:5.6e-12,d:"Mg(OH)2(s) = Mg^2+ + 2OH-"});
P("Ca(OH)2(s)",-986.1,83.4,{sc:"#f6f6f6",cw:"white (milky)",name:"Calcium hydroxide",ksp:5.5e-6,d:"Ca(OH)2(s) = Ca^2+ + 2OH-"});
P("Cu(OH)2(s)",-449.8,108,{sc:"#6fa8f0",cw:"pale blue",name:"Copper(II) hydroxide",ksp:2.2e-20,d:"Cu(OH)2(s) = Cu^2+ + 2OH-"});
P("Zn(OH)2(s)",-641.9,81.2,{sc:"#f2f2f2",cw:"white gelatinous",name:"Zinc hydroxide",ksp:3e-17,d:"Zn(OH)2(s) = Zn^2+ + 2OH-"});
P("Fe(OH)2(s)",-574,88,{sc:"#7ba483",cw:"dirty-green",name:"Iron(II) hydroxide",ksp:8e-16,d:"Fe(OH)2(s) = Fe^2+ + 2OH-"});
P("Fe(OH)3(s)",-823,106.7,{sc:"#a8501c",cw:"reddish-brown",name:"Iron(III) hydroxide",ksp:4e-38,d:"Fe(OH)3(s) = Fe^3+ + 3OH-"});
P("CaCO3(s)",-1207.6,91.7,{lid:"caco3",sc:"#fbfbfb",cw:"white (milky)",name:"Calcium carbonate (marble)",ksp:3.3e-9,kd:5e-4,d:"CaCO3(s) = Ca^2+ + CO3^2-",born:"white solid forms"});
/* insoluble salts */
const Q=(id,H,Sd,o)=>S(id,H,Sd,Object.assign({ppt:1,kd:1e-6},o));
Q("AgCl(s)",-127.0,96.3,{lid:"agcl",sc:"#f6f6f4",cw:"white curdy",name:"Silver chloride",ksp:1.8e-10,d:"AgCl(s) = Ag+ + Cl-"});
Q("AgBr(s)",-100.4,107.1,{lid:"agbr",sc:"#f2ecc8",cw:"pale yellow",name:"Silver bromide",ksp:5e-13,d:"AgBr(s) = Ag+ + Br-"});
Q("AgI(s)",-61.8,115.5,{sc:"#f2e04a",cw:"yellow",name:"Silver iodide",ksp:8.5e-17,d:"AgI(s) = Ag+ + I-"});
Q("BaSO4(s)",-1473.2,132.2,{sc:"#fafafa",cw:"white",name:"Barium sulphate",ksp:1.1e-10,d:"BaSO4(s) = Ba^2+ + SO4^2-"});
Q("PbSO4(s)",-920.0,148.5,{sc:"#f4f4f4",cw:"white",name:"Lead sulphate",ksp:2e-8,d:"PbSO4(s) = Pb^2+ + SO4^2-"});
Q("PbI2(s)",-175.5,174.9,{sc:"#f0c814",cw:"golden-yellow",name:"Lead iodide",ksp:7e-9,d:"PbI2(s) = Pb^2+ + 2I-"});
Q("PbCl2(s)",-359.4,136,{sc:"#f2f2f2",cw:"white",name:"Lead chloride",ksp:1.7e-5,d:"PbCl2(s) = Pb^2+ + 2Cl-"});
/* soluble solid reagents (dissolve at a rate; heat of solution comes from the data) */
const SS=(id,H,Sd,o)=>S(id,H,Sd,Object.assign({sc:"#f6f6f6"},o));
SS("K2SO4(s)",-1437.8,175.6,{lid:"k2so4",name:"Potassium sulphate",ksp:1.3,kd:.0016,d:"K2SO4(s) = 2K+ + SO4^2-"});
SS("NH4NO3(s)",-365.6,151.1,{lid:"nh4no3",name:"Ammonium nitrate",ksp:100,kd:.003,d:"NH4NO3(s) = NH4+ + NO3-"});
SS("NH4Cl(s)",-314.4,94.6,{lid:"nh4cl",name:"Ammonium chloride",ksp:25,kd:.003,d:"NH4Cl(s) = NH4+ + Cl-"});
SS("CuSO4(s)",-771.4,109.2,{lid:"cuso4a",sc:"#f4f4f2",name:"Anhydrous copper sulphate",ksp:1,kd:.003,d:"CuSO4(s) = Cu^2+ + SO4^2-"});
SS("Pb(NO3)2(s)",-451.9,217.9,{lid:"pbn",name:"Lead nitrate",ksp:13,kd:.003,d:"Pb(NO3)2(s) = Pb^2+ + 2NO3-"});
SS("FeSO4(s)",-928.4,107.5,{lid:"feso4a",sc:"#e6e6dc",name:"Anhydrous ferrous sulphate",ksp:2,kd:.002,born:"the green crystals lose water and turn pale grey-white",d:"FeSO4(s) = Fe^2+ + SO4^2-"});
SS("FeSO4.7H2O(s)",-3014.6,409.2,{lid:"feso4s",sc:"#8fc08f",name:"Ferrous sulphate crystals",ksp:2.2,kd:.002,d:"FeSO4.7H2O(s) = Fe^2+ + SO4^2- + 7H2O(l)"});
SS("Ba(OH)2.8H2O(s)",-3342.2,427,{lid:"baoh2",name:"Barium hydroxide",ksp:.06,kd:.003,d:"Ba(OH)2.8H2O(s) = Ba^2+ + 2OH- + 8H2O(l)"});
/* aqueous ions and molecules (dH, S at 298 K, aqueous standard state) */
const AQ=(id,H,Sd,o)=>S(id,H,Sd,o);
AQ("H+",0,0,{leg:"H",name:"hydrogen ion"});AQ("OH-",-230.0,-10.8,{leg:"OH"});
AQ("Na+",-240.1,59.0,{leg:"Na"});AQ("K+",-252.4,102.5,{leg:"K"});AQ("NH4+",-132.5,113.4,{leg:"NH4"});
AQ("Ag+",105.6,72.7,{leg:"Ag"});AQ("Cu^2+",64.8,-99.6,{leg:"Cu",col:[40,120,235],eps:2.2,cg:"Cu"});
AQ("Zn^2+",-153.9,-112.1,{leg:"Zn"});AQ("Fe^2+",-89.1,-137.7,{leg:"Fe2",col:[170,215,170],eps:3,cg:"Fe2"});
AQ("Fe^3+",-48.5,-315.9,{leg:"Fe3",col:[215,150,50],eps:5,cg:"Fe3"});AQ("Mg^2+",-466.9,-138.1,{leg:"Mg"});
AQ("Ca^2+",-542.8,-53.1,{leg:"Ca"});AQ("Pb^2+",-1.7,10.5,{leg:"Pb"});AQ("Ba^2+",-537.6,9.6,{leg:"Ba"});
AQ("Cl-",-167.2,56.5,{leg:"Cl"});AQ("Br-",-121.6,82.4,{leg:"Br"});AQ("I-",-55.2,111.3,{leg:"I"});
AQ("SO4^2-",-909.3,20.1,{leg:"SO4"});AQ("NO3-",-207.4,146.4,{leg:"NO3"});
AQ("CO3^2-",-677.1,-56.9,{leg:"CO3"});AQ("HCO3-",-692.0,91.2,{leg:"HCO3"});AQ("CH3COO-",-486.0,86.6,{leg:"Ac"});
AQ("CH3COOH(aq)",-485.8,178.7,{leg:"HAc"});AQ("CO2(aq)",-413.8,117.6,{});AQ("NH3(aq)",-80.3,111.3,{});
AQ("CuOH+",0,0,{leg:"Cu",cg:"Cu"});AQ("FeOH^2+",0,0,{leg:"Fe3",cg:"Fe3"});AQ("ZnOH+",0,0,{leg:"Zn"});
AQ("FeOH+",0,0,{leg:"Fe2",cg:"Fe2"});AQ("PbOH+",0,0,{leg:"Pb"});AQ("MgOH+",0,0,{leg:"Mg"});
S("H2O(l)",-285.8,69.9,{name:"water"});S("H2O(g)",-241.8,188.8,{gk:"H2O"});
/* gases (gk = key in the vessel's headspace) */
const G=(id,H,Sd,o)=>S(id,H,Sd,o);
G("H2(g)",0,130.7,{gk:"H2",gmsg:"colourless, odourless gas bubbles are given off (hydrogen)",smell:"no smell"});
G("O2(g)",0,205.2,{gk:"O2",gmsg:"colourless gas collects (oxygen)",smell:"no smell"});
G("CO2(g)",-393.5,213.8,{gk:"CO2",gmsg:"effervescence: a colourless gas is given off (carbon dioxide)",smell:"no smell"});
G("NO2(g)",33.2,240.1,{gk:"NO2",col:[150,70,20],ga:1.7,gmsg:"brown fumes of nitrogen dioxide are given off (poisonous: do not inhale)",smell:"a sharp, irritating smell: nitrogen dioxide. It is poisonous, so do not breathe it in!"});
G("SO2(g)",-296.8,248.2,{gk:"SO2",gmsg:"a colourless gas with the smell of burning sulphur is given off (SO₂)",smell:"a choking smell of burning sulphur (sulphur dioxide)"});
G("SO3(g)",-395.7,256.8,{gk:"SO3",col:[235,235,240],ga:.5,gmsg:"dense white fumes appear (SO₃)",smell:"a choking, acidic smell"});
G("NH3(g)",-45.9,192.8,{gk:"NH3",gmsg:"a gas with a sharp ammonia smell is given off",smell:"a sharp, pungent smell of ammonia"});
G("Cl2(g)",0,223.1,{gk:"Cl2",col:[190,200,90],ga:.6,gmsg:"a pale greenish-yellow gas (chlorine) is given off",smell:"a choking, bleach-like smell (chlorine)"});
G("Br2(g)",30.9,245.5,{gk:"Br2",col:[160,70,30],ga:1.4,gmsg:"reddish-brown bromine vapour is given off",smell:"a harsh, irritating smell (bromine)"});
const GASBY={};for(const id in SP)if(SP[id].gk)GASBY[SP[id].gk]=id;
const LEG2SP={};for(const id in SP)if(SP[id].leg&&!/^(CuOH|FeOH|ZnOH|PbOH|MgOH)/.test(id))LEG2SP[SP[id].leg]=id;
const SOL2SP={};for(const id in SP)if(SP[id].lid)SOL2SP[SP[id].lid]=id;
/* ---------- reaction parsing, automatic balancing, thermodynamics ---------- */
function tok(t){const m=t.trim().match(/^(\d+)?(.+)$/);return[m[1]?+m[1]:1,m[2].trim()]}
function parseRxn(str){const [l,r]=str.split(" = ");const nu={};
 for(const t of l.split(" + ")){const [k,id]=tok(t);if(!SP[id])throw new Error("unknown species "+id);nu[id]=(nu[id]||0)-k}
 for(const t of r.split(" + ")){const [k,id]=tok(t);if(!SP[id])throw new Error("unknown species "+id);nu[id]=(nu[id]||0)+k}
 return nu}
function comp(id){const s=SP[id],o=Object.assign({},s.el);if(s.z)o.q=s.z;return o}
function checkBalanced(nu){const t={};for(const id in nu)add(t,comp(id),nu[id]);for(const e in t)if(Math.abs(t[e])>1e-9)return false;return true}
/* find integer coefficients so that atoms and charge balance (null-space of the composition matrix) */
function balance(reac,prod){
 const ids=reac.concat(prod),els=new Set();ids.forEach(i=>Object.keys(comp(i)).forEach(e=>els.add(e)));
 const rows=[...els].map(e=>ids.map((id,j)=>(comp(id)[e]||0)*(j<reac.length?1:-1)));
 const n=ids.length,A=rows.map(r=>r.slice());let piv=[],r=0;
 for(let c=0;c<n&&r<A.length;c++){let p=r;for(let i=r+1;i<A.length;i++)if(Math.abs(A[i][c])>Math.abs(A[p][c]))p=i;
  if(Math.abs(A[p][c])<1e-9)continue;[A[r],A[p]]=[A[p],A[r]];const d=A[r][c];for(let j=0;j<n;j++)A[r][j]/=d;
  for(let i=0;i<A.length;i++)if(i!==r){const f=A[i][c];for(let j=0;j<n;j++)A[i][j]-=f*A[r][j]}piv.push(c);r++}
 const free=[];for(let c=0;c<n;c++)if(!piv.includes(c))free.push(c);
 if(free.length!==1)return null;
 const v=new Array(n).fill(0);v[free[0]]=1;for(let i=0;i<piv.length;i++)v[piv[i]]=-A[i][free[0]];
 if(v.some(x=>x<-1e-9))return null;
 for(let m=1;m<=60;m++){const w=v.map(x=>x*m);if(w.every(x=>Math.abs(x-Math.round(x))<1e-6)){const k=w.map(Math.round),g=k.reduce((a,b)=>{while(b){[a,b]=[b,a%b]}return a});
   const nu={};ids.forEach((id,j)=>{const c=k[j]/g;nu[id]=(nu[id]||0)+(j<reac.length?-c:c)});return nu}}
 return null}
const dHof=nu=>{let h=0;for(const id in nu)h+=nu[id]*(SP[id].H||0);return h};
const dSof=nu=>{let s=0;for(const id in nu)s+=nu[id]*(SP[id].S||0);return s};
const dGof=(nu,T)=>dHof(nu)-T*dSof(nu)/1000;
const lnKof=(rx,T)=>rx.K!=null?Math.log(rx.K)-(rx.dH*1000/R_)*(1/T-1/TS):-dGof(rx.nu,T)*1000/(R_*T);
/* ---------- display of species and equations ---------- */
function pretty(id){const s=SP[id];let b=s.base.replace(/\./g,"·").replace(/([A-Za-z\)])(\d+)/g,(m,a,d)=>a+sub(d));
 if(s.z)b+=sup((Math.abs(s.z)>1?String(Math.abs(s.z)):"")+(s.z>0?"+":"-"));return b}
const formula=id=>pretty(id);
const withState=id=>pretty(id)+"("+SP[id].ph+")";
function fmtEq(nu,arrow){const L=[],Rr=[];for(const id in nu){const v=nu[id],k=Math.abs(v)===1?"":String(Math.abs(v));(v<0?L:Rr).push(k+withState(id))}return L.join(" + ")+" "+(arrow||"→")+" "+Rr.join(" + ")}
/* molecular equation: add spectator ions to a net ionic equation and regroup them into compounds */
function molEq(nu,c){
 const ions=Object.keys(nu).filter(id=>SP[id].z);if(!ions.length||!c)return null;
 let hasCat=ions.some(i=>SP[i].z>0),hasAn=ions.some(i=>SP[i].z<0);
 const best=sg=>{let b=null,m=0;for(const id in c.n){const s=SP[id];if(!s||s.ph!=="aq"||!s.z||nu[id]!==undefined||/^(CuOH|FeOH|ZnOH|PbOH|MgOH)/.test(id)||id==="H+"||id==="OH-")continue;if(Math.sign(s.z)===sg&&c.n[id]>m){m=c.n[id];b=id}}return b};
 const sc=best(1),sa=best(-1);if((hasCat&&!sa)||(hasAn&&!sc)&&false)return null;
 const need=(side)=>{const out=[];for(const id of ions){const v=nu[id];if((side<0)!==(v<0))continue;out.push([id,Math.abs(v)])}return out};
 const mk=(ion,n,spec)=>{const z1=Math.abs(SP[ion].z),z2=Math.abs(SP[spec].z);const nSpec=n*z1/z2;return{ion,n,spec,nSpec}};
 const lhs=[],rhs=[];
 for(const [id,n] of need(-1)){const spec=SP[id].z>0?sa:sc;if(!spec)return null;lhs.push(mk(id,n,spec))}
 for(const [id,n] of need(1)){const spec=SP[id].z>0?sa:sc;if(!spec)return null;rhs.push(mk(id,n,spec))}
 const used={};for(const m of lhs)used[m.spec]=(used[m.spec]||0)+m.nSpec;for(const m of rhs)used[m.spec]=(used[m.spec]||0)-m.nSpec;
 const leftC=used[sc]||0,leftA=used[sa]||0;
 const sal=(cat,an,nc,na)=>{const z1=SP[cat].z,z2=-SP[an].z;const g=(function gcd(a,b){return b?gcd(b,a%b):a})(z1,z2);const ncat=z2/g,nan=z1/g;const f=(id,k)=>{const b=pretty(id).replace(/[⁰¹²³⁺⁻]+$/,"");return k===1?b:(/[A-Z].*[A-Z]|[₀-₉]/.test(b)&&b.length>2?"("+b+")":b)+sub(k)};return f(cat,ncat)+f(an,nan)};
 const terms=(arr,side)=>arr.map(m=>{const cat=SP[m.ion].z>0?m.ion:m.spec,an=SP[m.ion].z>0?m.spec:m.ion;const g=(function gcd(a,b){return b?gcd(b,a%b):a})(SP[cat].z,-SP[an].z),ncat=-SP[an].z/g;const k=(SP[m.ion].z>0?m.n:m.nSpec)/ncat;return{f:sal(cat,an),k,ph:"aq",side}});
 const T={L:terms(lhs,-1),R:terms(rhs,1)};
 for(const id in nu){const s=SP[id];if(s.z)continue;(nu[id]<0?T.L:T.R).push({f:pretty(id),k:Math.abs(nu[id]),ph:s.ph})}
 if(sc&&sa&&Math.abs(leftC)>1e-9&&Math.abs(leftA)>1e-9){const cat=sc,an=sa,g=(function gcd(a,b){return b?gcd(b,a%b):a})(SP[cat].z,-SP[an].z),ncat=-SP[an].z/g;T.R.push({f:sal(cat,an),k:leftC/ncat,ph:"aq"})}
 const all=[...T.L,...T.R].map(t=>t.k);let mult=0;for(let m=1;m<=12&&!mult;m++)if(all.every(k=>Math.abs(k*m-Math.round(k*m))<1e-6))mult=m;
 if(!mult)return null;
 const fm=t=>{const k=Math.round(t.k*mult);return(k===1?"":k)+t.f+"("+t.ph+")"};
 return T.L.map(fm).join(" + ")+" → "+T.R.map(fm).join(" + ")}
/* ---------- reaction libraries (data, not code) ---------- */
const EQS=[];    // equilibria solved by mass action
function eq(str,o){const nu=parseRxn(str);if(!checkBalanced(nu))throw new Error("unbalanced: "+str);const rx=Object.assign({str,nu,dH:dHof(nu)},o);EQS.push(rx);return rx}
eq("H2O(l) = H+ + OH-",{K:1e-14,water:1,dH:55.8});
eq("CH3COOH(aq) = H+ + CH3COO-",{K:1.8e-5,dH:-0.4});
eq("CO2(aq) + H2O(l) = H+ + HCO3-",{K:4.5e-7,dH:9});
eq("HCO3- = H+ + CO3^2-",{K:4.7e-11,dH:15});
eq("NH4+ = H+ + NH3(aq)",{K:5.6e-10,dH:52});
eq("CO3^2- + H2O(l) = HCO3- + OH-",{K:1e-14/4.7e-11,dH:0});
eq("HCO3- = CO2(aq) + OH-",{K:1e-14/4.5e-7,dH:0});
eq("CH3COO- + H2O(l) = CH3COOH(aq) + OH-",{K:1e-14/1.8e-5,dH:0});
eq("NH3(aq) + H2O(l) = NH4+ + OH-",{K:1e-14/5.6e-10,dH:0});
for(const [m,k] of [["Cu^2+",5e-8],["Fe^3+",1e-3],["Zn^2+",1e-9],["Fe^2+",1e-8],["Pb^2+",1e-8],["Mg^2+",1e-11]]){const h=m.replace("^2+","OH+").replace("^3+","OH^2+");eq(m+" + H2O(l) = "+h+" + H+",{K:k,dH:0})}
for(const id in SP){const s=SP[id];if(s.d){const r=eq(s.d,{solid:id,kind:"sol"});if(s.ksp!=null)r.K=s.ksp;r.dH=dHof(r.nu)}}
/* acid routes for basic solids (rate depends on [H+]; K from the solubility product and the acid constants) */
const KA2=4.7e-11,KA1=4.5e-7,KW=1e-14;
const ACID=[["CaCO3(s) + 2H+ = Ca^2+ + CO2(aq) + H2O(l)",3.3e-9/(KA2*KA1)],["Mg(OH)2(s) + 2H+ = Mg^2+ + 2H2O(l)",5.6e-12/KW**2],["Ca(OH)2(s) + 2H+ = Ca^2+ + 2H2O(l)",5.5e-6/KW**2],
 ["Cu(OH)2(s) + 2H+ = Cu^2+ + 2H2O(l)",2.2e-20/KW**2],["Zn(OH)2(s) + 2H+ = Zn^2+ + 2H2O(l)",3e-17/KW**2],["Fe(OH)2(s) + 2H+ = Fe^2+ + 2H2O(l)",8e-16/KW**2],
 ["Fe(OH)3(s) + 3H+ = Fe^3+ + 3H2O(l)",4e-38/KW**3],["CuO(s) + 2H+ = Cu^2+ + H2O(l)",null],["ZnO(s) + 2H+ = Zn^2+ + H2O(l)",null],["MgO(s) + 2H+ = Mg^2+ + H2O(l)",null],["CaO(s) + 2H+ = Ca^2+ + H2O(l)",null]];
for(const [str,K] of ACID){const r=eq(str,{kind:"acid"});for(const id in r.nu)if(r.nu[id]<0&&SP[id].ph==="s")r.solid=id;if(K!=null)r.K=K;r.dH=dHof(r.nu)}
/* redox: every metal against every oxidant. Spontaneity from dG, speed from the cell potential. */
const METALS=[["Mg(s)","Mg^2+",.11],["Zn(s)","Zn^2+",1],["Fe(s)","Fe^2+",.3],["FeNail(s)","Fe^2+",.12],["Cu(s)","Cu^2+",2.8],["Pb(s)","Pb^2+",1],["Na(s)","Na+",1.7]];
const OXID=[["H+",["H2(g)"]],["H2O(l)",["OH-","H2(g)"]],["Cu^2+",["Cu(s)"]],["Ag+",["Ag(s)"]],["Pb^2+",["Pb(s)"]],["Fe^3+",["Fe^2+"]],["Fe^2+",["Fe(s)"]],["Zn^2+",["Zn(s)"]]];
const REDOX=[];
for(const [m,ion,kin] of METALS)for(const [ox,red] of OXID){
 if(ox===ion||(m.startsWith("Fe")&&ox==="Fe^2+"))continue;
 const prods=[ion].concat(red).filter((v,i,a)=>a.indexOf(v)===i);if(prods.includes(m))continue;
 const nu=balance([m,ox],prods);if(!nu)continue;
 const dG=dGof(nu,TS);if(dG>-1)continue;
 if(ox==="H2O(l)"&&m!=="Na(s)")continue;
 const n=Math.abs(nu[ion])*SP[ion].z,E=-dG*1000/(n*F_);
 REDOX.push({m,ion,ox,red,nu,E,kin:ox==="H2O(l)"?kin:kin,dH:dHof(nu),water:ox==="H2O(l)",gas:red.includes("H2(g)")})}
/* reactions with a barrier: thermal decomposition, burning, gas-solid, photolysis, solid-solid. k0 = rate at T0, Ea sets the temperature dependence. */
const RXNS=[];
function rxn(str,o){const nu=parseRxn(str);if(!checkBalanced(nu))throw new Error("unbalanced: "+str);RXNS.push(Object.assign({str,nu,dH:dHof(nu),dS:dSof(nu)},o))}
rxn("2Mg(s) + O2(g) = 2MgO(s)",{name:"Burning magnesium in air (combination, exothermic)",Ea:90,T0:700,k0:.15,dry:1,flash:"magnesium burns with a dazzling white flame and leaves a white ash (MgO)"});
rxn("2Cu(s) + O2(g) = 2CuO(s)",{name:"Heating copper in air (oxidation)",Ea:120,T0:600,k0:.004,dry:1});
rxn("CuO(s) + H2(g) = Cu(s) + H2O(g)",{name:"Hydrogen reduces hot copper(II) oxide (redox)",Ea:70,T0:450,k0:.3,dry:1});
rxn("FeSO4.7H2O(s) = FeSO4(s) + 7H2O(g)",{name:"Heating ferrous sulphate crystals (they lose water)",Ea:70,T0:360,k0:.05,dry:1});
rxn("2FeSO4(s) = Fe2O3(s) + SO2(g) + SO3(g)",{name:"Thermal decomposition of ferrous sulphate",Ea:190,T0:800,k0:.12,dry:1});
rxn("2Pb(NO3)2(s) = 2PbO(s) + 4NO2(g) + O2(g)",{name:"Thermal decomposition of lead nitrate",Ea:150,T0:700,k0:.15,dry:1,crackle:230});
rxn("CaCO3(s) = CaO(s) + CO2(g)",{name:"Thermal decomposition of limestone",Ea:180,T0:1150,k0:.004,dry:1});
rxn("2AgCl(s) = 2Ag(s) + Cl2(g)",{name:"Decomposition of silver chloride by light",hv:1,k0:.012});
rxn("2AgBr(s) = 2Ag(s) + Br2(g)",{name:"Decomposition of silver bromide by light",hv:1,k0:.012});
rxn("Ba(OH)2.8H2O(s) + 2NH4Cl(s) = Ba^2+ + 2Cl- + 2NH3(g) + 10H2O(l)",{name:"Barium hydroxide + ammonium chloride (endothermic)",Ea:40,T0:298,k0:.4,mix:1});
for(const r of RXNS)r.K=undefined;
/* ---------- container state ---------- */
const WATER=[200,225,245];
const RX=new Map(),OBS=[];let simTime=0;
function regRx(name,eqs,ion){if(!RX.has(eqs)){RX.set(eqs,{name,eq:eqs,ion:ion||""});window._rxDirty=true}}
function log(c,text){OBS.push({t:simTime,c:c.label,text});if(OBS.length>300)OBS.shift();window._obsDirty=true}
const mix=(a,b,w)=>[a[0]+(b[0]-a[0])*w,a[1]+(b[1]-a[1])*w,a[2]+(b[2]-a[2])*w];
const hex=c=>"#"+c.map(v=>Math.round(Math.max(0,Math.min(255,v))).toString(16).padStart(2,"0")).join("");
const hx=h=>[1,3,5].map(i=>parseInt(h.substr(i,2),16));
const Z=(c,k)=>c.sp[k]||0;
const SOLCOL={},SOLNAME={},PPT=[];
for(const id in SP){const s=SP[id];if(s.lid){SOLCOL[s.lid]=s.sc||"#cccccc";SOLNAME[s.lid]=s.name}
 if(s.ppt)PPT.push({id,n:pretty(id).replace(/\(.*$/,""),col:s.sc,cw:s.cw||"white",mm:s.M})}
const DEPCOL={Cu:"#b8733a",Ag:"#cfd2da",Pb:"#7a7a85",Fe:"#5a5a60",Zn:"#9aa7b3"},DEPWORD={Cu:"reddish-brown",Ag:"silvery",Pb:"grey",Fe:"dark grey",Zn:"grey"};
const DEPSYM={"Cu(s)":"Cu","Ag(s)":"Ag","Pb(s)":"Pb","Fe(s)":"Fe","Zn(s)":"Zn"};
const LEGQ={"Mg(s)":"mg","Zn(s)":"zn","Fe(s)":"fe","FeNail(s)":"nail","Cu(s)":"cu"};
function newContainer(type,label){
 const cap={beaker:250,tube:20,flask:250,cyl:100,btube:30,dish:150,watch:40,mug:500}[type];
 return{id:0,type,label,cap,vol:0,T:25,n:{},p:{},d:{},gh:{},ind:{},susp:0,gasRate:0,gasType:"",heat:false,heatW:0,boil:false,flash:0,disp:null,mount:null,q:{},sunE:0,inv:false,cork:false,stirE:0,drops:0,stir:0,probes:[],neut:0,
  sp:{},sol:{},ppt:{},dep:{},made:{},last:{p:{},n:{},d:{},gs:{},made:{},T:25,neut:false,col:[200,225,245],cname:"colourless",gas:false}}}
const amt=(c,id)=>(c.n[id]||0)+(c.p[id]||0)+(c.d[id]||0);
function take(c,id,a){let t=Math.min(c.p[id]||0,a);if(t)c.p[id]-=t;a-=t;t=Math.min(c.n[id]||0,a);if(t)c.n[id]-=t;a-=t;t=Math.min(c.d[id]||0,a);if(t)c.d[id]-=t}
function give(c,id,a,form){const s=SP[id];
 if(s.ph==="g"){if(s.gk)gasAdd(c,s.gk,a);return}
 if(s.ph==="l"){if(id==="H2O(l)")c.vol=Math.max(0,c.vol+a*18);return}
 if(s.ph==="s"){const m=form||"n";(c[m][id]=(c[m][id]||0)+a);if(m==="n"||m==="p"){c.made[id]=1}return}
 c.n[id]=(c.n[id]||0)+a}
function gasAdd(c,gk,a){c.gh[gk]=(c.gh[gk]||0)+a;c._g=(c._g||0)+a;c.gasType=gk}
const heatCapJ=c=>{let sm=0;for(const id in c.n)if(SP[id].ph==="s")sm+=c.n[id]*SP[id].M;return c.vol>=.2?(c.vol+10)*4.18+sm*.8:14+sm*.8};
function heatIn(c,J){c.T+=J/(c.vol>=.2?(c.vol+5)*4.18:heatCapJ(c))}
const pHead=c=>Math.max(.005,(c.cap*1.4-Math.max(0,c.vol))/1000);
const AMB={O2:.21,CO2:4e-4,H2O:.02};
function pgas(c,gk){const open=!c.cork&&!c.inv;return clampv((open?(AMB[gk]||0):0)+(c.gh[gk]||0)*24.45/pHead(c),0,1.5)}
const tfac=c=>Math.exp(Math.min(3,(c.T-25)/25))*(c.stir>0?1.4:1);
/* ---------- equilibrium solver (mass action, Gauss-Seidel over the reaction list) ---------- */
function relax(c,r,V,dt,capLeft){
 const T=c.T+273.15,lnK=lnKof(r,T);let lo=-Infinity,hi=Infinity;const ids=Object.keys(r.nu);
 for(const id of ids){const s=SP[id],nu=r.nu[id];if(s.ph==="l"||s.ph==="g")continue;
  const have=s.ph==="s"?amt(c,id):(c.n[id]||0);
  if(nu>0)lo=Math.max(lo,-have/nu);else hi=Math.min(hi,have/-nu)}
 if(lo>hi)return 0;
 const f=x=>{let q=0;for(const id of ids){const s=SP[id],nu=r.nu[id];if(s.ph==="s"||s.ph==="l"||s.ph==="g")continue;q+=nu*Math.log(Math.max(1e-30,((c.n[id]||0)+nu*x)/V))}return q-lnK};
 const f0=f(0);let a,b;
 if(f0>0){a=Math.max(lo,-50);b=0}else{a=0;b=Math.min(hi,50)}
 if(a>=b)return 0;
 let x;const fa=f(a),fb=f(b);
 if(fa>0)x=a;else if(fb<0)x=b;else{for(let i=0;i<70;i++){const m=(a+b)/2;if(f(m)>0)b=m;else a=m}x=(a+b)/2}
 if(x<0&&r.solid&&SP[r.solid].nopp)x=0;
 if(x>0&&r.solid){ // dissolving a bulk solid is limited by surface area
  const id=r.solid,nu=-r.nu[id],fromP=(c.p[id]||0)/nu;const ck=id+(r.kind==="acid"?":a":":s");let cp=capLeft[ck];
  if(cp===undefined){const s=SP[id],mass=(c.n[id]||0)*s.M,h=Math.max(1e-14,(c.n["H+"]||0)/V);
   cp=s.kd*Math.pow(Math.max(mass,0),.6667)*Math.exp(Math.min(3,(c.T-25)/(s.kT||25)))*(c.stir>0?2:1)*dt;
   if(s.basic&&r.kind==="acid")cp*=Math.pow(Math.min(1,h),.6);else if(s.basic)cp*=(s.kw!==undefined?s.kw:2e-3);
   capLeft[ck]=cp}
  const allow=fromP+cp/nu;if(x>allow)x=allow;capLeft[ck]=Math.max(0,cp-Math.max(0,x-fromP)*nu)}
 if(Math.abs(x)<1e-16)return 0;
 for(const id of ids){const s=SP[id],nu=r.nu[id],dn=nu*x;
  if(s.ph==="l"){if(id==="H2O(l)"&&!r.water)c.vol=Math.max(.05,c.vol+dn*18);continue}
  if(s.ph==="g"){if(s.gk)gasAdd(c,s.gk,dn);continue}
  if(s.ph==="s"){if(dn>0){c.p[id]=(c.p[id]||0)+dn}else take(c,id,-dn);continue}
  c.n[id]=Math.max(0,(c.n[id]||0)+dn)}
 heatIn(c,-r.dH*1000*x);
 if(r.water&&x<0)c.neut+=-x;
 return Math.abs(x)}
function eqSolve(c,dt){const V=c.vol/1000;if(V<2e-4)return;const capLeft={};
 for(let sw=0;sw<24;sw++){let moved=0;for(const r of EQS)moved+=relax(c,r,V,dt,capLeft);if(moved<1e-13)break}}
/* ---------- redox: metals and oxidants ---------- */
function redox(c,dt){
 const V=c.vol/1000;if(V<2e-4)return;const tf=tfac(c);
 for(const rd of REDOX){
  const mTot=amt(c,rd.m);if(mTot<1e-7)continue;
  const oxn=rd.ox==="H2O(l)"?1:(c.n[rd.ox]||0);if(oxn<1e-9)continue;
  const conc=rd.ox==="H2O(l)"?1:oxn/V;if(conc<1e-4)continue;
  const q=(c.q[LEGQ[rd.m]]!==undefined?c.q[LEGQ[rd.m]]:1);
  const k=4.4e-4*Math.pow(10,1.1*rd.E)*rd.kin*q;
  let xi=k*Math.pow(conc,rd.ox==="H2O(l)"?0:.75)*Math.pow(mTot,.67)*tf*dt*(rd.ox==="H2O(l)"?1:1);
  xi=Math.min(xi,mTot/-rd.nu[rd.m],rd.ox==="H2O(l)"?1e9:oxn/-rd.nu[rd.ox]);
  if(!(xi>1e-14))continue;
  for(const id in rd.nu){const nu=rd.nu[id],dn=nu*xi,s=SP[id];
   if(nu<0){if(s.ph==="s")take(c,id,-dn);else if(id==="H2O(l)")c.vol=Math.max(.05,c.vol+dn*18);else c.n[id]=Math.max(0,(c.n[id]||0)+dn)}
   else if(s.ph==="g")gasAdd(c,s.gk,dn);
   else if(s.ph==="s"){c.d[id]=(c.d[id]||0)+dn;c.made[id]=1}
   else c.n[id]=(c.n[id]||0)+dn}
  heatIn(c,-rd.dH*1000*xi);
  if(rd.m==="Na(s)")c.flash=Math.max(c.flash||0,.4);
  regRxNet(c,rd.nu,rd.gas?"Metal + acid / water (redox)":rd.red[0]&&SP[rd.red[0]].ph==="s"?"Displacement reaction":"Redox reaction")}
}
function regRxNet(c,nu,name){const e=fmtEq(nu);if(RX.has(e))return;const m=molEq(nu,c);regRx(name,m||e,m?e:"")}
/* ---------- reactions with a barrier ---------- */
function dataRx(c,dt){
 const T=c.T+273.15,dry=c.vol<.2;
 for(const r of RXNS){
  if(r.dry&&!dry)continue;
  let solN=0,minTot=Infinity,sc=0;
  for(const id in r.nu){if(r.nu[id]<0&&SP[id].ph==="s"){sc++;minTot=Math.min(minTot,amt(c,id)/-r.nu[id])}}
  if(!(minTot>1e-7))continue;
  for(const id in r.nu){if(r.nu[id]<0&&SP[id].ph==="g"&&pgas(c,SP[id].gk)<1e-5)minTot=0}
  if(!(minTot>1e-9))continue;
  if(r.crackle&&c.T>=r.crackle&&!c.crk){c.crk=1;log(c,"the crystals crackle and jump about (decrepitation)")}
  let drive=1,k;
  if(r.hv){if(!c.sun)continue;k=r.k0}
  else{let lnQ=0;for(const id in r.nu){const s=SP[id];if(s.ph==="g")lnQ+=r.nu[id]*Math.log(Math.max(1e-6,pgas(c,s.gk||"H2O")))}
   const x=dGof(r.nu,T)*1000/(R_*T)+lnQ;if(x>=0)continue;drive=1-Math.exp(x);
   k=r.k0*Math.exp(Math.min(40,-r.Ea*1000/R_*(1/T-1/r.T0)))}
  const q=r.dry&&r.nu["Mg(s)"]!==undefined?(c.q.mg!==undefined?Math.max(.2,c.q.mg):1):1;
  const mixf=r.mix?Math.min(1,(c.stirE||0)/250+.015):1;
  let xi=Math.min(minTot,k*drive*q*mixf*Math.pow(minTot,.67)*dt);
  if(r.nu["Mg(s)"]!==undefined)xi=Math.min(minTot,Math.max(xi,k*drive*q*3e-4*dt));
  if(!(xi>1e-14))continue;
  for(const id in r.nu){const nu=r.nu[id],dn=nu*xi,s=SP[id];
   if(nu<0){if(s.ph==="s")take(c,id,-dn);else if(s.ph==="g"&&s.gk&&c.gh[s.gk]!==undefined&&(c.cork||c.inv||!AMB[s.gk]))c.gh[s.gk]=Math.max(0,c.gh[s.gk]+dn)}
   else if(s.ph==="g"){if(id==="H2O(g)")c.drops=1;else gasAdd(c,s.gk,dn)}
   else give(c,id,dn,s.ph==="s"?"n":null)}
  heatIn(c,-r.dH*1000*xi);
  if(r.flash&&xi*Math.abs(r.dH)>.02){c.flash=1;if(!c.last.fl){c.last.fl=1;log(c,r.flash)}}
  regRxNet(c,r.nu,r.name)}
}
/* ---------- heating, cooling, boiling, gas leaving the vessel, gas dissolving ---------- */
function thermal(c,dt){
 const W=c.heatW||0,liq=c.vol>=.2,capJ=heatCapJ(c);
 if(W>0){if(liq){if(c.T<100){c.T=Math.min(100,c.T+W*.7*dt/capJ);c.boil=false}else{c.T=100;c.boil=true;c.vol=Math.max(0,c.vol-W*.7*dt/2260);if(c.vol<.2&&c.vol>0)c.vol=0}}
  else{c.T=Math.min(900,c.T+W*dt/capJ);c.boil=false}}
 else{c.T+=(25-c.T)*Math.min(1,(liq?.02:.012)*dt);if(c.T<99)c.boil=false}
 c.stirE=(c.stirE||0)*Math.exp(-.6*dt);
 const ESC={H2:.8,O2:.04,CO2:.05,NO2:.1,SO2:.12,SO3:.1,NH3:.3,Cl2:.08,Br2:.06};
 if(!c.cork&&!c.inv)for(const k in c.gh){c.gh[k]*=Math.exp(-(ESC[k]||.1)*dt);if(c.gh[k]<1e-12)delete c.gh[k]}
 if(c.drops>0)c.drops=Math.max(0,c.drops-.01*dt);
}
function gasExchange(c,dt){
 const V=c.vol/1000;if(V<2e-4)return;
 for(const [aq,gk,kH] of [["CO2(aq)","CO2",.034],["NH3(aq)","NH3",57]]){
  if(c._in&&c._in[gk]>0){const a=Math.min(c._in[gk]*.85,c.gh[gk]||0);c.n[aq]=(c.n[aq]||0)+a;c.gh[gk]=Math.max(0,(c.gh[gk]||0)-a);c._in[gk]=0}
  const na=c.n[aq]||0,nsat=kH*pgas(c,gk)*V,dn=(na-nsat)*(1-Math.exp(-.8*dt));
  if(dn>0){c.n[aq]=na-dn;gasAdd(c,gk,dn)}
  else if(dn<0){const want=-dn,fromHead=Math.min(want,c.gh[gk]||0);c.gh[gk]=Math.max(0,(c.gh[gk]||0)-fromHead);c.n[aq]=na+fromHead+((c.cork||c.inv)?0:want-fromHead)}}}
/* ---------- projection to the fields the interface reads ---------- */
function project(c){
 const sp={},sol={},ppt={},dep={};
 for(const id in c.n){const v=c.n[id];if(!(v>1e-15))continue;const s=SP[id];if(!s)continue;
  if(s.ph==="s"){if(s.lid)sol[s.lid]=(sol[s.lid]||0)+v*s.M}else if(s.leg)sp[s.leg]=(sp[s.leg]||0)+v}
 for(const id in c.p)if(c.p[id]>1e-15)ppt[id]=c.p[id];
 for(const id in c.d){const v=c.d[id];if(v>1e-15&&DEPSYM[id])dep[DEPSYM[id]]=(dep[DEPSYM[id]]||0)+v*SP[id].M}
 c.sp=sp;c.sol=sol;c.ppt=ppt;c.dep=dep}
/* ---------- public API used by the lab ---------- */
function phOf(c){const V=c.vol/1000;if(V<2e-4)return null;const h=Math.max(1e-15,(c.n["H+"]||0)/V);return clampv(-Math.log10(h),0,14)}
function addLiquid(c,ch,ml){
 if(c.vol+ml>c.cap+1e-9)return false;
 const Vn=c.vol+ml;c.T=(c.T*c.vol+25*ml)/Vn;
 for(const k in ch.c){const id=LEG2SP[k];if(id)c.n[id]=(c.n[id]||0)+ch.c[k]*ml/1000}
 if(ch.ind)c.ind[ch.ind]=(c.ind[ch.ind]||0)+ml;
 c.vol=Vn;eqSolve(c,0);project(c);return true}
function addSolid(c,lid,g){const id=SOL2SP[lid];if(!id)return false;c.n[id]=(c.n[id]||0)+g/SP[id].M;project(c);return true}
function pourTo(a,b,f){
 const space=b.cap-b.vol;let amtv=a.vol*f;if(amtv>space)amtv=space;if(amtv<=0)return 0;const fr=amtv/a.vol;
 const Vn=b.vol+amtv;b.T=(b.T*b.vol+a.T*amtv)/Vn;
 for(const id in a.n){const s=SP[id];if(s.ph==="aq"){const m=a.n[id]*fr;b.n[id]=(b.n[id]||0)+m;a.n[id]-=m}}
 for(const k in a.ind){b.ind[k]=(b.ind[k]||0)+a.ind[k]*fr;a.ind[k]*=1-fr}
 for(const id in a.p){const m=a.p[id]*fr*a.susp;b.p[id]=(b.p[id]||0)+m;a.p[id]-=m}
 b.susp=Math.max(b.susp,a.susp);b.vol=Vn;a.vol-=amtv;
 if(a.vol<.05){a.vol=0;for(const id in a.n)if(SP[id].ph==="aq")a.n[id]=0;a.ind={}}
 eqSolve(b,0);eqSolve(a,0);project(a);project(b);return amtv}
function step(c,dt){
 c._g=0;thermal(c,dt);
 if(c.vol>=.2){redox(c,dt)}
 dataRx(c,dt);
 if(c.vol>=.2){eqSolve(c,dt);gasExchange(c,dt)}
 c.susp*=Math.exp(-dt*.07);if(c.stir>0){c.stir-=dt;c.susp=Math.min(1,c.susp+dt*.4)}
 c.gasRate=(c._g||0)/dt;project(c)}
/* ---------- colour of the solution (from the species database + indicators) ---------- */
function uiColor(ph){const st=[[0,"#e11d1d"],[2,"#ef4423"],[3.5,"#f58a1f"],[5,"#f6c020"],[6,"#b6d62e"],[7,"#3fae49"],[8,"#1ba58b"],[9,"#2a7fc4"],[10.5,"#4a4fb8"],[12,"#6d3aa8"],[14,"#5a2d8c"]];
 for(let i=1;i<st.length;i++)if(ph<=st[i][0]){const t=(ph-st[i-1][0])/(st[i][0]-st[i-1][0]);return mix(hx(st[i-1][1]),hx(st[i][1]),t)}return hx(st[st.length-1][1])}
function solnColour(c){
 let col=WATER.slice(),V=c.vol/1000;if(V<2e-4)return{rgb:col,alpha:.35};
 const g={};for(const id in c.n){const s=SP[id];if(s&&s.cg){g[s.cg]=(g[s.cg]||0)+c.n[id]/V}}
 for(const id in SP){const s=SP[id];if(s.col&&s.cg&&!s.gk&&g[s.cg]>1e-5){col=mix(col,s.col,1-Math.exp(-g[s.cg]*s.eps));g[s.cg]=0}}
 let alpha=.38+Math.min(.3,(1-Math.exp(-((g.Cu||0)+((c.n["Cu^2+"]||0)/V))*2))*.3);
 const ph=phOf(c);
 for(const k in c.ind){const ml=c.ind[k];if(ml<=1e-6||ph==null)continue;
  const w0=Math.min(.9,.35+ml/c.vol*60);let ic,w=w0;
  if(k==="ph"){const f=Math.max(0,Math.min(1,(ph-8.2)/1.8));ic=[225,40,140];w=w0*f}
  else if(k==="mo"){ic=ph<3.1?[224,52,47]:ph<4.4?mix([224,52,47],[242,194,48],(ph-3.1)/1.3):[242,194,48]}
  else if(k==="btb"){ic=ph<6?[242,214,50]:ph<7.6?mix([242,214,50],[40,120,215],(ph-6)/1.6):[40,120,215]}
  else ic=uiColor(ph);
  col=mix(col,ic,w);alpha=Math.max(alpha,.35+.3*w)}
 return{rgb:col,alpha}}
function cname(rgb){
 const dist=Math.hypot(rgb[0]-WATER[0],rgb[1]-WATER[1],rgb[2]-WATER[2]);if(dist<38)return"colourless";
 const r=rgb[0]/255,g=rgb[1]/255,b=rgb[2]/255,mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;let h=0;
 if(d){if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360}
 if(l<.18)return"dark";if(l>.88&&d<.15)return"colourless";
 if(h<14||h>=345)return l>.7?"pink":"red";if(h<40)return l<.5?"brown":"orange";if(h<68)return"yellow";if(h<165)return l>.62?"light green":"green";
 if(h<200)return"cyan / blue-green";if(h<255)return l>.7?"light blue":"blue";if(h<290)return"violet";return l>.62?"pink":"magenta"}
/* ---------- observations written from the species data ---------- */
function observe(c){
 const L=c.last;
 for(const id in c.p){const v=c.p[id],w=L.p[id]||0,s=SP[id];
  if(v>5e-6&&w<=5e-6){log(c,(s.cw||"white")+" precipitate of "+pretty(id).replace(/\(.*$/,"")+" forms");if(c.el&&window.spawnPlume)spawnPlume(c,s.sc,.85)}
  else if(v<=5e-6&&w>5e-6)log(c,"the precipitate of "+pretty(id).replace(/\(.*$/,"")+" dissolves");L.p[id]=v}
 for(const id in c.made){const s=SP[id],tot=amt(c,id);
  if(s.ph==="s"&&tot>2e-5&&!L.made[id]&&c.made[id]&&!s.ppt){L.made[id]=1;if(s.born)log(c,s.born);else log(c,(s.cw||"solid")+" "+pretty(id).replace(/\(.*$/,"")+" forms")}}
 for(const id in c.d){const v=c.d[id],w=L.d[id]||0,sy=DEPSYM[id];if(sy&&v>8e-6&&w<=8e-6)log(c,DEPWORD[sy]+" deposit of "+sy+" forms on the metal");L.d[id]=v}
 for(const id in c.n){const s=SP[id];if(!s||s.ph!=="s")continue;const v=c.n[id],w=L.n[id]||0;
  if(w>1e-6&&v<=1e-6&&(c.vol>.2||c.heatW>0))log(c,(s.name||pretty(id)).toLowerCase()+" has completely reacted / dissolved");L.n[id]=v}
 L.gs=L.gs||{};
 for(const gk in c.gh){const id=GASBY[gk],s=SP[id];if(s&&c.gh[gk]>1e-7&&!L.gs[gk]){L.gs[gk]=1;if(s.gmsg&&gk!=="H2"&&gk!=="CO2"&&gk!=="O2")log(c,s.gmsg)}else if(!(c.gh[gk]>1e-8))L.gs[gk]=0}
 const gr=c.gasRate>2e-7;
 if(gr&&!L.gas){if(c.gasType==="H2")log(c,SP["H2(g)"].gmsg);else if(c.gasType==="CO2")log(c,SP["CO2(g)"].gmsg);else if(c.gasType==="O2")log(c,SP["O2(g)"].gmsg);L.gas=true}
 else if(!gr&&L.gas&&c.gasRate<5e-8){log(c,"bubbling stops");L.gas=false}
 if(c.boil&&!L.boil){log(c,"the liquid boils: vapour bubbles form and steam rises");L.boil=true}else if(!c.boil&&c.T<95)L.boil=false;
 if(c.flash<.05)L.fl=0;
 if(c.neut>5e-5&&!L.neut){log(c,"acid and base neutralise (H⁺ + OH⁻ → H₂O)");L.neut=true;regRx("Neutralisation","H⁺(aq) + OH⁻(aq) → H₂O(l)")}
 if(c.drops>.5&&!L.drp){L.drp=1;log(c,"tiny drops of water condense on the cooler upper part of the tube")}
 if(c.T-L.T>=(c.heatW>0?(c.vol>=.2?15:150):4)){log(c,c.heatW>0?(c.vol>=.2?"the liquid heats up to ":"the dry vessel heats up to ")+c.T.toFixed(0)+" °C":"mixture warms up to "+c.T.toFixed(0)+" °C (exothermic)");L.T=c.T}
 else if(c.T<L.T-4){if(c.T<22&&!(c.heatW>0))log(c,"the mixture gets colder: "+c.T.toFixed(0)+" °C (an endothermic change)");L.T=c.T}
 const sc=solnColour(c),nm=cname(sc.rgb),d=Math.hypot(sc.rgb[0]-L.col[0],sc.rgb[1]-L.col[1],sc.rgb[2]-L.col[2]);
 if(d>32&&c.vol>.3){if(nm!==L.cname)log(c,nm==="colourless"?"solution turns colourless":"solution turns "+nm);L.cname=nm;L.col=sc.rgb}}
function tickContainer(c,dt){const n=Math.max(1,Math.ceil(dt/.25)),h=dt/n;for(let i=0;i<n;i++)step(c,h);observe(c)}
const react=c=>{eqSolve(c,0);project(c)};
function emptyContainer(c){c.vol=0;c.n={};c.p={};c.d={};c.gh={};c.ind={};c.sp={};c.sol={};c.ppt={};c.dep={};c.made={};c.q={};c.susp=0;c.gasRate=0;c.gasType="";c.neut=0;c.T=25;c.last={p:{},n:{},d:{},gs:{},made:{},T:25,neut:false,col:[200,225,245],cname:"colourless",gas:false}}
window.Engine={phOf,react,step,addLiquid,addSolid,pourTo,newContainer,solnColour,cname,tickContainer,RX,OBS,SP,EQS,REDOX,RXNS,balance,parseRxn,fmtEq,molEq,dGof,dHof,dSof,lnKof,checkBalanced,pretty,observe,log,regRx,setTime:t=>{simTime=t},SOLCOL,SOLNAME,DEPCOL,DEPWORD,PPT,mix,hex,hx,uiColor,WATER,emptyContainer};
})();
