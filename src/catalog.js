import './directory.css';
import gemPreview from './assets/gem-preview.png';
import { TECHNIQUES } from './techniques.js';
import ditherPreview from './assets/surface-dither-preview.png';
const previews={gem:gemPreview,'surface-dither':ditherPreview};

// Preserve the previously published gem URLs.
if(new URLSearchParams(location.search).has('shape')){
  location.replace(new URL(`techniques/gem.html${location.search}${location.hash}`,location.href));
}else{
  const categories=[...new Set(TECHNIQUES.map(t=>t.category))];
  const total=String(TECHNIQUES.length).padStart(2,'0');
  document.querySelector('#app').innerHTML=`
  <header class="directory-header"><a class="directory-brand" href="./"><span class="directory-mark">▦</span> ArtHub <span>/ 目录</span></a><a href="https://github.com/LuxJadestone/ArtHub" target="_blank" rel="noreferrer">GitHub ↗</a></header>
  <main class="directory-main"><section class="directory-title"><div><span class="directory-code">INDEX / 001</span><h1>技术目录</h1></div><dl><div><dt>技术</dt><dd>${total}</dd></div><div><dt>分类</dt><dd>${String(categories.length).padStart(2,'0')}</dd></div></dl></section>
  <section class="directory-toolbar" aria-label="目录筛选"><div class="category-tabs" role="group" aria-label="分类"><button data-category="all" aria-pressed="true">全部 <span>${total}</span></button>${categories.map(c=>`<button data-category="${c}" aria-pressed="false">${c} <span>${String(TECHNIQUES.filter(t=>t.category===c).length).padStart(2,'0')}</span></button>`).join('')}</div><label class="search-field"><span>⌕</span><input type="search" id="search" aria-label="搜索技术" placeholder="名称 / 分类 / 参数"></label></section>
  <div class="directory-count"><span>技术目录</span><output id="result-count" aria-live="polite">${TECHNIQUES.length} 项</output></div>
  <section class="technique-grid" aria-label="技术目录">${TECHNIQUES.map(t=>`<a class="technique-card" data-id="${t.id}" href="${t.path}"><div class="technique-cover cover-${t.id}"><img class="${t.id==='gem'?'gem-preview':'surface-preview'}" src="${previews[t.id]}" alt=""><span class="card-index">${t.number}</span><span class="card-engine">${t.engine}</span></div><div class="technique-info"><div class="technique-category">${t.category}</div><div class="technique-name"><h2>${t.name}</h2><span>↗</span></div><div class="technique-english">${t.english}</div><div class="technique-tags">${t.tags.map(tag=>`<span>${tag}</span>`).join('')}</div></div></a>`).join('')}</section><p id="empty-result" class="empty-result" hidden>0 项</p>
  <footer class="directory-footer"><span>ArtHub</span><span>NPR / WEBGL 2</span></footer></main>`;
  let category='all';
  function filter(){
    const query=document.querySelector('#search').value.trim().toLowerCase();let count=0;
    for(const t of TECHNIQUES){
      const visible=(category==='all'||t.category===category)&&[t.name,t.english,t.category,t.engine,...t.tags].join(' ').toLowerCase().includes(query);
      document.querySelector(`[data-id="${t.id}"]`).hidden=!visible;if(visible)count++;
    }
    document.querySelector('#result-count').value=`${count} 项`;document.querySelector('#empty-result').hidden=count!==0;
  }
  document.querySelectorAll('[data-category]').forEach(button=>button.addEventListener('click',()=>{
    category=button.dataset.category;
    document.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));filter();
  }));
  document.querySelector('#search').addEventListener('input',filter);
}
