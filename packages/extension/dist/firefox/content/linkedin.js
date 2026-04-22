const N="linkedin";function g(e,t){var r;for(const o of t){const n=e.querySelector(o),i=(r=n==null?void 0:n.textContent)==null?void 0:r.trim();if(i)return i}return null}function j(e){var o;const t=e.parentElement;return t&&((o=t.textContent)==null?void 0:o.trim())||null}function R(e){const t=e.querySelectorAll('svg[id="check-small"]'),r=[];for(const o of Array.from(t)){const n=j(o);n&&r.push(n)}return r}function V(e){const t=R(e),r={salary:null,workplace:null,employment:null,experience:null};for(const o of t)!r.salary&&/\$[\d,.]+/.test(o)?r.salary=o:!r.workplace&&/\b(Remote|Hybrid|On-site)\b/i.test(o)?r.workplace=o:!r.employment&&/\b(Full-time|Part-time|Contract|Temporary|Internship)\b/i.test(o)?r.employment=o:!r.experience&&/\b(Entry|Associate|Mid-Senior|Senior|Executive|Director)\b/i.test(o)&&(r.experience=o);return r}function F(e){var a,l;const t=e.querySelector('[data-testid="expandable-text-box"]');if(!t)return null;const r=t.parentElement;if(!r)return null;const o=Array.from(r.children),n=o.indexOf(t);if(n<0)return null;const i=(a=t.textContent)==null?void 0:a.trim();if(i)return i;const s=[];for(let c=n+1;c<o.length;c++){const u=(l=o[c].textContent)==null?void 0:l.trim();u&&s.push(u)}return s.length>0?s.join(`
`):null}function P(e){const t=e.querySelector('a[data-tracking-control-name*="apply-link-offsite"]');if(!(t!=null&&t.href))return null;try{const o=new URL(t.href).searchParams.get("url");if(o)return decodeURIComponent(o)}catch{}return null}function H(e){const t=e.querySelector('a[href*="/company/"]');if(!(t!=null&&t.href))return null;try{const o=new URL(t.href).pathname.match(/^\/company\/[^/]+/);if(o)return`https://www.linkedin.com${o[0]}/`}catch{}return null}function z(e,t){const r=['div[data-display-contents="true"] > p',"h1.top-card-layout__title","h1.topcard__title",'[data-test-id="job-title"]',"h1.jobs-unified-top-card__job-title"];function o(){const p=e.querySelector('[aria-label^="Company,"]');if(p){const w=(p.getAttribute("aria-label")??"").replace(/^Company,\s*/i,"").replace(/\.\s*$/,"").trim();if(w)return w}return g(e,["a.topcard__org-name-link",'[data-tracking-control-name="public_jobs_topcard-org-name"]',".jobs-unified-top-card__company-name a",".jobs-unified-top-card__company-name"])}function n(){const p=F(e);return p&&p.length>50?p:g(e,["div.show-more-less-html__markup",".jobs-description__content",".jobs-description-content__text",'[data-test-id="job-description"]'])}const i=g(e,r),s=o(),a=n();if(!i&&!a)return null;let l=null,c=null;const d=V(e);d.salary&&(l=d.salary),c=g(e,[".job-details-jobs-unified-top-card__bullet",".topcard__flavor--bullet",".jobs-unified-top-card__bullet",'[data-test-id="job-location"]']),!c&&d.workplace&&(c=d.workplace),l||(l=g(e,[".compensation__salary-range",".job-details-jobs-unified-top-card__job-insight span"]));const u={found:{title:i,company:s,location:c,description:a==null?void 0:a.slice(0,200),salary:l}},h=P(e),b=H(e);return{title:i,company:s,location:c,salary_range:l,description:a,url:t,extracted_at:new Date().toISOString(),source_plugin:N,raw_fields:u,apply_url:h,company_url:b}}function B(e){try{const t=new URL(e);return t.search="",t.hash="",t.pathname.endsWith("/")||(t.pathname+="/"),t.toString()}catch{return e}}const J={name:N,matches:["linkedin.com","*.linkedin.com"],capabilities:{extractJD:z,normalizeUrl:B}},W=/^\s*[-*+•]\s|^\s*\d+[.)]\s/;function Y(e){const t=e.trim();if(!t||W.test(t))return null;const r=t.match(/^#{1,4}\s+(.+?)\s*$/);if(r)return{heading:r[1].trim(),remainder:null};const o=t.match(/^<h[2-4][^>]*>(.+?)<\/h[2-4]>\s*$/i);if(o)return{heading:o[1].trim(),remainder:null};const n=t.match(/^\*{2}(.+?)\*{2}\s*:?\s*(.*)$/);if(n){const i=n[1].trim(),s=n[2].trim();return{heading:i,remainder:s||null}}if(/^[A-Z][A-Z\s&/,'-]*$/.test(t)&&t.length>=8)return{heading:t,remainder:null};if(t.length<=60&&!t.includes(".")&&!t.includes(",")){const i=t.toLowerCase();if(["about","overview","summary","responsibilities","requirements","qualifications","preferred","benefits","compensation","salary","location","role","position","company","team","culture","opportunity","skills","experience","what you","what we","how to apply","equal opportunity","nice to have"].some(a=>i.includes(a))){const a=t.split(/\s+/);if(a.length>=2&&a.length<=8&&/^[A-Z]/.test(a[0]))return{heading:t,remainder:null}}}return null}function K(e){if(!e||e.trim().length===0)return[];const t=e.split(`
`),r=[];let o=null,n=[],i=0,s=0;for(let l=0;l<t.length;l++){const c=t[l],d=Y(c);if(d!==null){const u=n.join(`
`).trim();(o!==null||u.length>0)&&r.push({heading:o,text:u,byteOffset:i}),o=d.heading,n=[],i=s,d.remainder&&n.push(d.remainder)}else n.push(c);s+=Buffer.byteLength(c,"utf-8")+1}const a=n.join(`
`).trim();return(o!==null||a.length>0)&&r.push({heading:o,text:a,byteOffset:i}),r}const M={responsibilities:[{word:"responsibilities",weight:3},{word:"what you will do",weight:3},{word:"what you'll do",weight:3},{word:"key responsibilities",weight:3},{word:"main responsibilities",weight:3},{word:"role responsibilities",weight:2},{word:"duties",weight:2},{word:"you will",weight:1},{word:"your role",weight:1},{word:"day to day",weight:1}],requirements:[{word:"requirements",weight:3},{word:"qualifications",weight:3},{word:"required qualifications",weight:3},{word:"minimum qualifications",weight:3},{word:"must have",weight:2},{word:"must-have",weight:2},{word:"what we are looking for",weight:3},{word:"what we're looking for",weight:3},{word:"what you need",weight:2},{word:"what you'll need",weight:2},{word:"what you'll bring",weight:2},{word:"skills & competencies",weight:2},{word:"years of experience",weight:1},{word:"years experience",weight:1},{word:"proficiency",weight:1},{word:"experience with",weight:.5}],preferred:[{word:"preferred qualifications",weight:3},{word:"desired qualifications",weight:3},{word:"nice to have",weight:3},{word:"nice-to-have",weight:3},{word:"strong candidates",weight:3},{word:"strong candidate",weight:2},{word:"preferred",weight:2},{word:"bonus",weight:2},{word:"ideally",weight:1},{word:"a plus",weight:1},{word:"is a plus",weight:2},{word:"strong plus",weight:2}],description:[{word:"about the role",weight:3},{word:"about this role",weight:3},{word:"position summary",weight:3},{word:"role overview",weight:3},{word:"overview",weight:2},{word:"position overview",weight:3},{word:"the role",weight:1},{word:"join our",weight:2},{word:"we are seeking",weight:2},{word:"we are looking for",weight:2},{word:"ideal candidate",weight:2},{word:"looking for a",weight:2},{word:"to join",weight:1},{word:"we offer",weight:1}],location:[{word:"location",weight:3},{word:"locations",weight:3},{word:"office location",weight:3},{word:"work location",weight:3},{word:"based in",weight:1},{word:"office",weight:.5}],compensation:[{word:"compensation",weight:3},{word:"salary",weight:3},{word:"annual salary",weight:3},{word:"pay range",weight:3},{word:"base salary",weight:3},{word:"compensation and benefits",weight:2},{word:"total compensation",weight:3},{word:"per year",weight:1},{word:"annually",weight:1},{word:"/yr",weight:1},{word:"/hr",weight:1}],benefits:[{word:"benefits",weight:3},{word:"perks",weight:3},{word:"what we offer",weight:3},{word:"our benefits",weight:3},{word:"health insurance",weight:1},{word:"401k",weight:1},{word:"401(k)",weight:1},{word:"paid time off",weight:1},{word:"pto",weight:1},{word:"equity",weight:.5}],about_company:[{word:"about us",weight:3},{word:"about the company",weight:3},{word:"about the team",weight:3},{word:"who we are",weight:3},{word:"our mission",weight:2},{word:"our values",weight:2},{word:"our culture",weight:2},{word:"company overview",weight:3},{word:"company description",weight:3},{word:"about anthropic",weight:3},{word:"mission is",weight:1}],eeo:[{word:"equal opportunity",weight:3},{word:"equal employment",weight:3},{word:"eeo",weight:3},{word:"do not discriminate",weight:2},{word:"affirmative action",weight:2},{word:"regardless of race",weight:2},{word:"nondiscrimination",weight:2},{word:"protected veteran",weight:1}]},G=["responsibilities","requirements","preferred","description","location","compensation","benefits","about_company","eeo"];function Z(e,t){let r=0,o=0;for(;(o=e.indexOf(t,o))!==-1;)r++,o+=t.length;return r}function X(e,t){var s,a,l;const r=M[t];let o=0;const n=((s=e.heading)==null?void 0:s.toLowerCase())??"",i=e.text.toLowerCase();for(const{word:c,weight:d}of r)n.includes(c)&&(o+=d*3),o+=Z(i,c)*d;if(t==="compensation"&&n){const c=/\$\s*[\d,]+/g,d=((a=n.match(c))==null?void 0:a.length)??0,u=((l=i.match(c))==null?void 0:l.length)??0;o+=d*3+u*2}return o}function Q(e,t){return e===0?.3:t&&e>=6?.95:t&&e>=3?.9:e>=6?.8:e>=3?.65:e>=1?.5:.3}function ee(e){return e.map(t=>{let r="description",o=0;for(const s of G){const a=X(t,s);a>o&&(o=a,r=s)}const n=t.heading!==null&&M[r].some(s=>t.heading.toLowerCase().includes(s.word)),i=Q(o,n);return{...t,category:r,confidence:i}})}const te=[/\$\s*([\d,]+(?:\.\d+)?)\s*[—–\-]\s*\$\s*([\d,]+(?:\.\d+)?)/,/\$\s*(\d+)\s*k\s*[—–\-]\s*\$\s*(\d+)\s*k/i,/\$\s*([\d,]+(?:\.\d+)?)\s+to\s+\$\s*([\d,]+(?:\.\d+)?)/i,/\$\s*(\d+)\s*k\s+to\s+\$\s*(\d+)\s*k/i,/from\s+\$\s*([\d,]+(?:\.\d+)?)\s+to\s+\$\s*([\d,]+(?:\.\d+)?)/i],C=/\/\s*h(?:ou)?r|per\s+hour|hourly/i,oe=/\/\s*y(?:ea)?r|per\s+year|annual|annually|USD/i;function x(e){return parseFloat(e.replace(/,/g,""))}function re(e){const t=[...e.filter(r=>r.category==="compensation"),...e.filter(r=>r.category!=="compensation")];for(const r of t){const o=r.text.split(`
`);for(const n of o)for(const i of te){const s=n.match(i);if(s){let a=x(s[1]),l=x(s[2]);a<1e3&&l<1e3&&/k/i.test(n)&&(a*=1e3,l*=1e3);const c=C.test(n)?"hourly":a>=1e3||oe.test(n)?"annual":"unknown";return{min:a,max:l,period:c}}}}for(const r of t)for(const o of r.text.split(`
`)){if(!/salary|compensation|pay|starting/i.test(o))continue;const n=o.match(/\$\s*([\d,]+(?:\.\d+)?)\s*(?:\/\s*(?:yr|year|hour|hr))?\b/);if(n){const i=x(n[1]);if(i<100)continue;const s=C.test(o)?"hourly":"annual";return{min:i,max:i,period:s}}}return null}const ne=new Set(["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC"]),E=/(?:^|[;,.\s])((?:[A-Z][a-zA-Z.'-]+\s?){1,4}),\s*([A-Z]{2})\b/g;function ie(e){const t=[...e.filter(o=>o.category==="location"),...e.filter(o=>o.category==="description"||o.category==="compensation"),...e.filter(o=>!["location","description","compensation"].includes(o.category))],r=new Set;for(const o of t){E.lastIndex=0;let n;for(;(n=E.exec(o.text))!==null;){const i=n[1].trim(),s=n[2];ne.has(s)&&r.add(`${i}, ${s}`)}}return[...r]}const se=[/fully\s+remote/i,/100%\s+remote/i,/remote\s+position/i,/remote\s+role/i,/this\s+is\s+a\s+(?:fully\s+)?remote/i],ae=[/\bremote\b/i],le=[/hybrid\s+(?:position|role|work|schedule|arrangement)/i,/\bhybrid\b/i,/days?\s+(?:per\s+week|\/\s*week)\s+in[\s-]?office/i,/in[\s-]?office\s+\d+/i,/\d+\s+days?\s+(?:per\s+week|\/\s*week|in[\s-]?office)/i],ce=[/\bon[\s-]?site\b/i,/\bin[\s-]?person\b/i];function de(e){let t=0,r=0,o=0;for(const n of e){const i=n.text;for(const s of se)s.test(i)&&(t+=3);for(const s of ae)s.test(i)&&(t+=1);for(const s of le)s.test(i)&&(r+=3);for(const s of ce)s.test(i)&&(o+=2)}return r>0&&r>=t?"hybrid":t>0?"remote":o>0?"on-site":null}function ue(e){const t=K(e),r=ee(t),o=re(r),n=ie(r),i=de(r);return{sections:r,salary:o,locations:n,workPosture:i}}const A={high:3,medium:2,low:1,absent:0},D={title:"high",company:"high",salary_min:"medium",salary_max:"medium",work_posture:"medium",location:"medium",company_url:"high",url:"high",apply_url:"low",description:"high",source_plugin:"high",parsed_requirements:"absent",parsed_responsibilities:"absent",parsed_preferred:"absent"},pe=Object.keys(D);function T(e){const t={};for(const r of pe)t[r]=e;return t}const _={user:D,debug:T("high"),dev:T("absent")},fe=[{field:"title",check:e=>e.title!=null&&e.title!==""},{field:"company",check:e=>e.company!=null&&e.company!==""},{field:"salary_min",check:e=>e.salary_min!=null},{field:"salary_max",check:e=>e.salary_max!=null},{field:"work_posture",check:e=>e.work_posture!=null&&e.work_posture!==""},{field:"location",check:e=>e.location!=null&&e.location!==""},{field:"company_url",check:e=>e.company_url!=null&&e.company_url!==""},{field:"url",check:e=>e.url!=null&&e.url!==""},{field:"apply_url",check:e=>e.apply_url!=null&&e.apply_url!==""},{field:"description",check:e=>e.description!=null&&e.description!==""},{field:"source_plugin",check:e=>e.source_plugin!=null&&e.source_plugin!==""},{field:"parsed_requirements",check:e=>{if(!e.parsed_sections)return!1;try{return JSON.parse(e.parsed_sections).some(r=>r.category==="requirements")}catch{return!1}}},{field:"parsed_responsibilities",check:e=>{if(!e.parsed_sections)return!1;try{return JSON.parse(e.parsed_sections).some(r=>r.category==="responsibilities")}catch{return!1}}},{field:"parsed_preferred",check:e=>{if(!e.parsed_sections)return!1;try{return JSON.parse(e.parsed_sections).some(r=>r.category==="preferred")}catch{return!1}}}];function I(e,t={}){return fe.map(({field:r,check:o})=>{if(t[r])return{field:r,tier:t[r].tier,source:t[r].source};const n=o(e);return{field:r,tier:n?"high":"absent",source:n?"selector":"missing"}})}function he(e,t,r=!1){if(r)return!0;for(const o of e){const n=t[o.field];if(n!=null&&A[o.tier]<A[n])return!0}return!1}async function ge(){try{const t=(await chrome.storage.local.get("forge_confidence_mode")).forge_confidence_mode;if(t&&t in _)return _[t]}catch{}return _.user}function we(e){var i,s,a;const t={};if(e.title&&(t.title={tier:"high",source:"selector"}),e.company&&(t.company={tier:"high",source:"selector"}),e.url&&(t.url={tier:"high",source:"selector"}),e.description&&(t.description={tier:"high",source:"selector"}),e.source_plugin&&(t.source_plugin={tier:"high",source:"selector"}),e.company_url&&(t.company_url={tier:"high",source:"selector"}),e.apply_url&&(t.apply_url={tier:"medium",source:"selector"}),e.salary_range&&(t.salary_min={tier:"high",source:"chip"},t.salary_max={tier:"high",source:"chip"}),e.location&&(t.location={tier:"high",source:"chip"}),!e.description){const l=I(e,t);return{extracted:e,confidence:l}}const r=ue(e.description),o={...e,salary_min:((i=r.salary)==null?void 0:i.min)!=null?Math.round(r.salary.min):null,salary_max:((s=r.salary)==null?void 0:s.max)!=null?Math.round(r.salary.max):null,salary_period:((a=r.salary)==null?void 0:a.period)??null,work_posture:r.workPosture,parsed_locations:r.locations,parsed_sections:JSON.stringify(r.sections)};e.salary_range||(o.salary_min!=null&&(t.salary_min={tier:"medium",source:"parser-body"}),o.salary_max!=null&&(t.salary_max={tier:"medium",source:"parser-body"})),o.work_posture&&(t.work_posture={tier:"medium",source:"parser-body"}),!e.location&&o.parsed_locations&&o.parsed_locations.length>0&&(t.location={tier:"medium",source:"parser-body"});const n=I(o,t);return{extracted:o,confidence:n}}const f=e=>e==null?"":String(e),k=[{key:"title",label:"Job Title",getValue:e=>f(e.title),setValue:(e,t)=>({...e,title:t||null}),type:"text"},{key:"company",label:"Company",getValue:e=>f(e.company),setValue:(e,t)=>({...e,company:t||null}),type:"text"},{key:"location",label:"Location",getValue:e=>f(e.location),setValue:(e,t)=>({...e,location:t||null}),type:"text"},{key:"salary_min",label:"Salary Min",getValue:e=>f(e.salary_min),setValue:(e,t)=>({...e,salary_min:t?Number(t):null}),type:"text"},{key:"salary_max",label:"Salary Max",getValue:e=>f(e.salary_max),setValue:(e,t)=>({...e,salary_max:t?Number(t):null}),type:"text"},{key:"work_posture",label:"Work Posture",getValue:e=>f(e.work_posture),setValue:(e,t)=>({...e,work_posture:t||null}),type:"text"},{key:"company_url",label:"Company URL",getValue:e=>f(e.company_url),setValue:(e,t)=>({...e,company_url:t||null}),type:"text"},{key:"apply_url",label:"Apply URL",getValue:e=>f(e.apply_url),setValue:(e,t)=>({...e,apply_url:t||null}),type:"text"},{key:"url",label:"Job URL",getValue:e=>f(e.url),setValue:(e,t)=>({...e,url:t}),type:"text"}];function me(e){switch(e){case"high":return"#4ade80";case"medium":return"#fbbf24";case"low":return"#f87171";case"absent":return"#f87171"}}function ye(e){switch(e){case"high":return"✓";case"medium":return"⚠";case"low":return"✗";case"absent":return"✗"}}function L(e,t){return t.find(r=>r.field===e)??{field:e,tier:"absent",source:"missing"}}function O(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}const q="forge-overlay-host",be=`
  :host {
    all: initial;
  }
  .overlay-panel {
    position: fixed;
    top: 0;
    right: 0;
    width: 360px;
    height: 100vh;
    background: #1a1a2e;
    color: #e0e0e0;
    font-family: -apple-system, system-ui, 'Segoe UI', sans-serif;
    display: flex;
    flex-direction: column;
    z-index: 2147483647;
    box-shadow: -4px 0 16px rgba(0, 0, 0, 0.4);
    border-left: 1px solid #333;
  }

  /* Header */
  .overlay-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    border-bottom: 1px solid #333;
    flex-shrink: 0;
  }
  .overlay-title {
    font-size: 14px;
    font-weight: 600;
    color: #e0e0e0;
  }
  .overlay-close {
    background: none;
    border: none;
    color: #888;
    font-size: 18px;
    cursor: pointer;
    padding: 2px 6px;
    line-height: 1;
    border-radius: 4px;
  }
  .overlay-close:hover {
    color: #e0e0e0;
    background: rgba(255, 255, 255, 0.08);
  }

  /* Review badge */
  .review-badge {
    padding: 8px 16px;
    font-size: 12px;
    color: #fbbf24;
    border-bottom: 1px solid #333;
    flex-shrink: 0;
  }

  /* Scrollable field list */
  .field-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }

  /* Individual field row */
  .field-row {
    padding: 8px 16px;
    border-left: 3px solid transparent;
  }
  .field-row-high    { border-left-color: #4ade80; }
  .field-row-medium  { border-left-color: #fbbf24; }
  .field-row-low     { border-left-color: #f87171; }
  .field-row-absent  { border-left-color: #f87171; }

  .field-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
  }
  .field-label {
    font-size: 11px;
    font-weight: 600;
    color: #aaa;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .confidence-badge {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    font-weight: 500;
    padding: 1px 6px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.06);
  }
  .confidence-icon {
    font-size: 11px;
    line-height: 1;
  }

  /* Inputs */
  .field-input {
    width: 100%;
    padding: 6px 8px;
    background: #12121e;
    border: 1px solid #333;
    border-radius: 4px;
    color: #e0e0e0;
    font-size: 13px;
    font-family: inherit;
    box-sizing: border-box;
    outline: none;
    transition: border-color 0.15s;
  }
  .field-input:focus {
    border-color: #6366f1;
    box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.25);
  }
  textarea.field-input {
    resize: vertical;
    min-height: 60px;
  }

  /* Footer */
  .overlay-footer {
    display: flex;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid #333;
    flex-shrink: 0;
  }
  .btn {
    flex: 1;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    font-family: inherit;
    transition: background 0.15s;
  }
  .btn-ghost {
    background: transparent;
    border: 1px solid #444;
    color: #aaa;
  }
  .btn-ghost:hover {
    background: rgba(255, 255, 255, 0.06);
    color: #e0e0e0;
  }
  .btn-primary {
    background: #6366f1;
    color: #fff;
  }
  .btn-primary:hover {
    background: #5558e6;
  }
`;function xe(e,t,r){m();const o=document.createElement("div");o.id=q;const n=o.attachShadow({mode:"closed"}),i=k.filter(d=>L(d.key,t).tier!=="high").length,s=k.map(d=>{const u=L(d.key,t),h=me(u.tier),b=ye(u.tier),p=O(d.getValue(e)),S=`field-row-${u.tier}`,w=d.type==="textarea"?`<textarea class="field-input" data-field-key="${d.key}">${p}</textarea>`:`<input class="field-input" type="text" data-field-key="${d.key}" value="${p}" />`;return`
      <div class="field-row ${S}">
        <div class="field-label-row">
          <span class="field-label">${O(d.label)}</span>
          <span class="confidence-badge" style="color: ${h}">
            <span class="confidence-icon">${b}</span>
            ${u.tier}
          </span>
        </div>
        ${w}
      </div>
    `}).join("");n.innerHTML=`
    <style>${be}</style>
    <div class="overlay-panel">
      <div class="overlay-header">
        <span class="overlay-title">Forge — Review Extraction</span>
        <button class="overlay-close" aria-label="Close">✕</button>
      </div>
      <div class="review-badge">${i} field${i!==1?"s":""} need${i===1?"s":""} review</div>
      <div class="field-list">${s}</div>
      <div class="overlay-footer">
        <button class="btn btn-ghost" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" data-action="submit">Submit to Forge</button>
      </div>
    </div>
  `;const a=n.querySelector(".overlay-close"),l=n.querySelector('[data-action="cancel"]'),c=n.querySelector('[data-action="submit"]');a.addEventListener("click",()=>{m()}),l.addEventListener("click",()=>{m()}),c.addEventListener("click",()=>{let d={...e};for(const u of k){const h=n.querySelector(`[data-field-key="${u.key}"]`);h&&(d=u.setValue(d,h.value))}m(),r.onSubmit(d)}),document.body.appendChild(o)}function m(){const e=document.getElementById(q);e&&e.remove()}const $="forge-toast-host";function _e(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function y(e,t=3e3){const r=document.getElementById($);r&&r.remove();const o=document.createElement("div");o.id=$;const n=o.attachShadow({mode:"closed"});n.innerHTML=`
    <style>
      :host {
        all: initial;
      }
      .toast {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 2147483647;
        min-width: 260px;
        max-width: 360px;
        background: #1a1a2e;
        border: 1px solid #333;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        font-family: -apple-system, system-ui, 'Segoe UI', sans-serif;
        overflow: hidden;
        opacity: 1;
        transition: opacity 0.3s ease-out;
      }
      .toast.fade-out {
        opacity: 0;
      }
      .toast-header {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 10px 14px 6px;
        font-size: 12px;
        font-weight: 600;
        color: #4ade80;
        letter-spacing: 0.02em;
      }
      .toast-check {
        font-size: 14px;
        line-height: 1;
      }
      .toast-body {
        padding: 0 14px 12px;
        font-size: 13px;
        line-height: 1.4;
        color: #e0e0e0;
      }
    </style>
    <div class="toast">
      <div class="toast-header">
        <span class="toast-check">✓</span>
        <span>Forge</span>
      </div>
      <div class="toast-body">${_e(e)}</div>
    </div>
  `,document.body.appendChild(o);const i=n.querySelector(".toast");setTimeout(()=>{i.classList.add("fade-out"),setTimeout(()=>o.remove(),300)},t)}const v="forge-capture-btn";function ke(e){const t=['button[aria-label="Save"]','button[aria-label="Share"]','button[aria-label="More options"]'];for(const r of t){const o=e.querySelector(r);if(o)return o}return null}function U(e){if(e.getElementById(v))return!1;const t=ke(e);if(!t)return!1;const r=t.parentElement;if(!r)return!1;const o=e.createElement("button");return o.id=v,o.textContent="Capture to Forge",o.setAttribute("aria-label","Capture to Forge"),Object.assign(o.style,{display:"inline-flex",alignItems:"center",padding:"6px 16px",marginLeft:"8px",border:"1px solid #0a66c2",borderRadius:"24px",background:"transparent",color:"#0a66c2",fontFamily:"-apple-system, system-ui, sans-serif",fontSize:"14px",fontWeight:"600",cursor:"pointer",lineHeight:"1.33"}),o.addEventListener("click",async n=>{var i,s;n.preventDefault(),n.stopPropagation(),o.textContent="Capturing...",o.disabled=!0;try{const a=await chrome.runtime.sendMessage({cmd:"jd.captureActive",forceManual:n.shiftKey});a!=null&&a.ok?(i=a.data)!=null&&i.overlayShown?(o.textContent="Review in panel →",o.style.borderColor="#6366f1",o.style.color="#6366f1"):(o.textContent="✓ Captured",o.style.borderColor="#057642",o.style.color="#057642"):((s=a==null?void 0:a.error)==null?void 0:s.code)==="API_DUPLICATE"?(o.textContent="Already captured",o.style.borderColor="#666",o.style.color="#666"):(o.textContent="Failed",o.style.borderColor="#cc1016",o.style.color="#cc1016")}catch{o.textContent="Failed",o.style.borderColor="#cc1016",o.style.color="#cc1016"}setTimeout(()=>{o.textContent="Capture to Forge",o.disabled=!1,o.style.borderColor="#0a66c2",o.style.color="#0a66c2"},3e3)}),r.appendChild(o),!0}function ve(e){const t=e.getElementById(v);t&&t.remove()}function Se(e){let t=e.location.href;new MutationObserver(()=>{const o=e.location.href;o!==t&&(t=o,ve(e),setTimeout(()=>U(e),500))}).observe(e.body,{childList:!0,subtree:!0})}window.__forge_extension_linkedin_ready||(window.__forge_extension_linkedin_ready=!0,setTimeout(()=>U(document),500),Se(document),chrome.runtime.onMessage.addListener((e,t,r)=>e.cmd==="extract"?((async()=>{try{const o=J.capabilities.extractJD;if(!o){r({ok:!1,error:{code:"PLUGIN_THREW",message:"extractJD not defined"}});return}const n=o(document,location.href);if(!n){r({ok:!1,error:{code:"EXTRACTION_EMPTY",message:"Plugin returned null"}});return}const i=we(n),s=await ge(),a=!!e.forceManual;if(he(i.confidence,s,a))xe(i.extracted,i.confidence,{onSubmit:async l=>{var d,u;const c=await chrome.runtime.sendMessage({cmd:"jd.submitExtracted",data:l});if(c!=null&&c.ok)y(`Captured: ${l.title} at ${l.company}`);else{const h=(d=c==null?void 0:c.error)==null?void 0:d.code;y(h==="API_DUPLICATE"?"Job already captured":`Error: ${((u=c==null?void 0:c.error)==null?void 0:u.message)??"Unknown error"}`)}},onCancel:()=>{}}),r({ok:!0,data:{overlayShown:!0}});else{const l=await chrome.runtime.sendMessage({cmd:"jd.submitExtracted",data:i.extracted});l!=null&&l.ok&&y(`Captured: ${i.extracted.title} at ${i.extracted.company}`),r(l)}}catch(o){const n=o instanceof Error?o.message:String(o);r({ok:!1,error:{code:"PLUGIN_THREW",message:n}})}})(),!0):!1));
