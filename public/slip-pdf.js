// Payslip helpers shared by admin.html and slip.html: Indonesian wording, logo, and the PDF writer.
// PDF-START
const PDF_H=[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const PDF_B=[278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
async function pdfDeflate(u8){const cs=new CompressionStream('deflate'),w=cs.writable.getWriter();w.write(u8);w.close();return new Uint8Array(await new Response(cs.readable).arrayBuffer())}
const pdfTxt=s=>String(s??'').replace(/[\u2013\u2014]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201C\u201D]/g,'"').replace(/[^\x20-\xFF]/g,'?');
function pdfW(s,bold,size){const t=bold?PDF_B:PDF_H;let w=0;for(const ch of s){const c=ch.charCodeAt(0);w+=(c>=32&&c<=126?t[c-32]:556)}return w*size/1000}
const pdfEsc=s=>s.replace(/[\\()]/g,'\\$&');
function pdfWrap(s,bold,size,max){const out=[];let line='';for(const w of pdfTxt(s).split(' ')){const t=line?line+' '+w:w;if(pdfW(t,bold,size)>max&&line){out.push(line);line=w}else line=t}if(line)out.push(line);return out}
const pdfRp=n=>'Rp '+String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
// d: {name,type,period,issued,earnings,deductions,net,att,ver}  logo: {w,h,gray} (grey levels, already on white)
async function makePdf(d,logo){
  const PW=595.28,PH=841.89,M=54,RX=PW-M,INK='0.169 0.165 0.141',GREY='0.482 0.463 0.4',LINE='0.894 0.863 0.796',MATCHA='0.306 0.42 0.227';
  let c='';const Y=y=>(PH-y).toFixed(2);
  const txt=(s,x,y,size,bold,align)=>{s=pdfTxt(s);if(align==='r')x-=pdfW(s,bold,size);c+=`BT /${bold?'F2':'F1'} ${size} Tf ${x.toFixed(2)} ${Y(y)} Td (${pdfEsc(s)}) Tj ET\n`};
  const rule=(y,w)=>{c+=`${w} w ${M} ${Y(y)} m ${RX.toFixed(2)} ${Y(y)} l S\n`};
  const lh=logo?120*logo.h/logo.w:0;
  if(logo)c+=`q 120 0 0 ${lh.toFixed(2)} ${M} ${Y(48+lh)} cm /Im1 Do Q\n`;
  c+=`${GREY} rg\n`;txt('SLIP GAJI',RX,58,8,true,'r');
  c+=`${INK} rg\n`;txt(d.period,RX,78,15,true,'r');
  c+=`${INK} RG\n`;rule(108,1.6);
  const meta=[['Nama karyawan',d.name],['Jenis gaji',PTYPE_ID[d.type]||d.type],['Periode',d.period],['Tanggal terbit',d.issued]];
  meta.forEach(([l,v],i)=>{const x=i%2?310:M,y=132+Math.floor(i/2)*42;c+=`${GREY} rg\n`;txt(l,x,y,8,false);c+=`${INK} rg\n`;txt(v,x,y+16,11,true)});
  let y=232;
  const section=(title,rows,neg)=>{
    c+=`${GREY} rg\n`;txt(title.toUpperCase(),M,y,8,true);y+=8;
    if(!rows.length)rows=[{l:'Tidak ada',a:null}];
    for(const r of rows){
      c+=`${INK} rg\n`;txt(r.l,M,y+16,10.5,false);
      if(r.n){c+=`${GREY} rg\n`;txt(r.n,M,y+28,8.5,false)}
      c+=`${INK} rg\n`;txt(r.a==null?'-':(neg?'- ':'')+pdfRp(r.a),RX,y+16,10.5,false,'r');
      y+=r.n?38:28;c+=`${LINE} RG\n`;rule(y,0.5);
    }
    y+=16;
  };
  section('Pendapatan',d.earnings,false);section('Potongan',d.deductions,true);
  y+=4;c+=`${MATCHA} rg\n${M} ${Y(y+48)} ${(RX-M).toFixed(2)} 48 re f\n1 1 1 rg\n`;
  txt('GAJI BERSIH DITERIMA',M+18,y+29,9,true);txt(pdfRp(d.net),RX-18,y+32,19,true,'r');y+=48+22;
  c+=`${GREY} rg\n`;for(const ln of pdfWrap(d.att,false,8.5,RX-M)){txt(ln,M,y,8.5,false);y+=12}
  if(d.ver){y+=6;txt(d.ver,M,y,8.5,true)}
  const enc=s=>Uint8Array.from(s,ch=>ch.charCodeAt(0)&255);
  const parts=[],offs=[];let len=0;const push=u=>{parts.push(u);len+=u.length};
  const cat=(a,b)=>{const o=new Uint8Array(a.length+b.length);o.set(a);o.set(b,a.length);return o};
  const obj=(n,body)=>{offs[n]=len;push(enc(n+' 0 obj\n'));push(typeof body==='string'?enc(body):body);push(enc('\nendobj\n'))};
  const stream=(dict,bytes)=>cat(enc(`<< ${dict} /Length ${bytes.length} >>\nstream\n`),cat(bytes,enc('\nendstream')));
  push(enc('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'));
  obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
  obj(2,'<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >>${logo?' /XObject << /Im1 7 0 R >>':''} >> >>`);
  obj(4,stream('',enc(c)));
  obj(5,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  obj(6,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  if(logo)obj(7,stream(`/Type /XObject /Subtype /Image /Width ${logo.w} /Height ${logo.h} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`,await pdfDeflate(logo.gray)));
  const n=logo?8:7,xref=len;
  let x=`xref\n0 ${n}\n0000000000 65535 f \n`;for(let i=1;i<n;i++)x+=String(offs[i]).padStart(10,'0')+' 00000 n \n';
  push(enc(x+`trailer\n<< /Size ${n} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`));
  const out=new Uint8Array(len);let p=0;for(const u of parts){out.set(u,p);p+=u.length}return out;
}
// PDF-END

// The payslip itself (viewer and PDF) is in Indonesian.
const PTYPE_ID={monthly:'Bulanan',hourly:'Per jam',daily:'Harian'};
const idShort=d=>new Date(d+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short'});
const idLong=t=>new Date(t).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
function slipMeta(s){
  const period=s.from?`${idShort(s.from)} – ${idShort(s.to)} ${s.to.slice(0,4)}`:new Date(s.month+'-01T00:00:00').toLocaleDateString('id-ID',{month:'long',year:'numeric'});
  const att=`Masuk ${s.aDays} dari ${s.sDays} hari terjadwal`+(s.leaveDays?` | ${s.leaveDays} hari cuti tahunan (dibayar)`:'')+(s.lateDays?` | ${s.lateDays} kali terlambat`:'');
  return {period,att,issued:idLong(s.ver?s.ver.at:Date.now())};
}
const verLine=v=>v?`Diverifikasi oleh ${v.by} pada ${idLong(v.at)}`:'';
let logoCache;
async function getLogo(){
  if(logoCache)return logoCache;
  const img=new Image();img.src='/img/kurogi.png';await img.decode();
  const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
  const x=c.getContext('2d');x.drawImage(img,0,0);const px=x.getImageData(0,0,c.width,c.height).data,g=new Uint8Array(c.width*c.height);
  for(let i=0;i<g.length;i++)g[i]=Math.round(255-px[i*4+3]*(255-43)/255);
  return logoCache={w:c.width,h:c.height,gray:g};
}
async function slipPdf(e){
  const s=e.s,m=slipMeta(s);
  const bytes=await makePdf({name:s.name,type:s.type,period:m.period,issued:m.issued,earnings:s.earnings,deductions:s.deductions,net:s.net,att:m.att,ver:verLine(s.ver)},await getLogo().catch(()=>null));
  return new File([bytes],`Slip_Gaji_${s.name.replace(/[^A-Za-z0-9]+/g,'_')}_${s.key||s.month}.pdf`,{type:'application/pdf'});
}

const slipLink=s=>s.share?`${location.origin}/slip?k=${s.share}`:'';
