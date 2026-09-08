const INVITE="https://discord.gg/FQzUhm9xDu";
let faq=[],shown=10;

const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
document.querySelector("#year").textContent=new Date().getFullYear();

async function load(){
  try{const d=await fetch("/api/config").then(r=>r.json());faq=d.faq||[];renderFaq();}
  catch{faq=[];renderFaq();}
}
function renderFaq(){
  const query=document.querySelector("#faqSearch").value.toLowerCase().trim();
  const items=faq.filter(x=>(x[0]+" "+x[1]).toLowerCase().includes(query)).slice(0,shown);
  document.querySelector("#faqList").innerHTML=items.map((x,i)=>`
    <div class="faq-item">
      <button class="faq-q" onclick="toggleFaq(this)"><span>${esc(x[0])}</span><span>+</span></button>
      <div class="faq-a">${esc(x[1])}</div>
    </div>`).join("")||`<div style="padding:25px;color:#777;font-size:13px">No matching questions.</div>`;
  document.querySelector("#moreFaq").style.display=(query||shown>=faq.length)?"none":"inline-block";
}
function toggleFaq(btn){const item=btn.parentElement;item.classList.toggle("open");btn.lastElementChild.textContent=item.classList.contains("open")?"−":"+"}
function showMoreFaq(){shown=Math.min(shown+10,faq.length);renderFaq()}
document.querySelector("#faqSearch").addEventListener("input",()=>{shown=10;renderFaq()});

function openApply(){
 document.querySelector("#dialogBody").innerHTML=`
 <div class="kicker">QUICK APPLICATION</div><h2>Join the community</h2>
 <p>Answer three quick questions. We'll send you straight to Discord for verification.</p>
 <form class="form" id="apply">
   <label>Minecraft username / gamertag<input name="ign" required maxlength="40" placeholder="Your in-game name"></label>
   <label>Platform<select name="platform"><option>Android</option><option>iPhone / iPad</option><option>Both</option></select></label>
   <label>Why do you want to join?<textarea name="reason" required maxlength="500" placeholder="A short, honest answer"></textarea></label>
   <button class="button primary">Continue to Discord ↗</button>
 </form>`;
 document.querySelector("#apply").addEventListener("submit",submitApply);
 document.querySelector("#modal").classList.add("open");
 document.querySelector("#modal").setAttribute("aria-hidden","false");
}
function closeApply(){document.querySelector("#modal").classList.remove("open");document.querySelector("#modal").setAttribute("aria-hidden","true")}
async function submitApply(e){
 e.preventDefault();
 const answers=Object.fromEntries(new FormData(e.target).entries());
 const r=await fetch("/api/apply",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({answers})});
 const d=await r.json();
 if(!r.ok){alert(d.error||"Please try again.");return}
 document.querySelector("#dialogBody").innerHTML=`
 <div class="kicker">NEXT STEP</div><h2>You're ready.</h2>
 <p>Your application has been received. Verification is handled directly in Discord so a real member of staff can help you.</p>
 <div class="success"><b>What to do:</b><br>1. Join the Discord server.<br>2. Read the verification instructions.<br>3. Open the verification ticket/channel requested by staff.<br>4. Use the same Minecraft username you entered here.
 <br><a class="button primary" href="${esc(d.invite||INVITE)}" target="_blank" rel="noopener">Join Discord ↗</a></div>`;
}
load();
window.openApply=openApply;window.closeApply=closeApply;window.showMoreFaq=showMoreFaq;window.toggleFaq=toggleFaq;
