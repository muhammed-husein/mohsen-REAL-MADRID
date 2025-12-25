// Dynamic gallery loader with local image preference and filter support
(function(){
  let allPlayers = window.PLAYER_DATA || [];
  let allManagers = window.MANAGER_DATA || [];
  let allTrophies = window.TROPHY_DATA || [];

  async function ensureData(){
    // ensure manager & trophy base data available
    allManagers = window.MANAGER_DATA || allManagers;
    allTrophies = window.TROPHY_DATA || allTrophies;

    // If players are provided inline, still fetch their thumbnails (and managers')
    if(allPlayers && allPlayers.length){
      try{ await fetchThumbnails(allPlayers); }catch(e){ /* ignore */ }
      try{ if(allManagers && allManagers.length) await fetchThumbnails(allManagers); }catch(e){ /* ignore */ }
      return allPlayers;
    }

    try{
      const res = await fetch('data/players.json');
      allPlayers = await res.json();
    }catch(e){
      console.error('Failed to load players data', e);
      allPlayers = [];
    }
    await fetchThumbnails(allPlayers);
    // fetch manager thumbnails (Wikipedia) if available
    try{
      if(allManagers && allManagers.length){ await fetchThumbnails(allManagers); }
    }catch(err){ console.warn('Failed to fetch manager thumbnails', err); }
    return allPlayers;
  }

  async function fetchThumbnails(players){
    const tasks = players.map(async (p)=>{
      if(!p.wiki) return;
      try{
        const title = encodeURIComponent(p.wiki);
        const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`;
        const res = await fetch(url);
        if(!res.ok) return;
        const json = await res.json();
        if(json && json.thumbnail && json.thumbnail.source){
          p._image = json.thumbnail.source;
        }
      }catch(e){ }
    });
    await Promise.allSettled(tasks);
  }

  // Normalize local image paths so they resolve when pages are served from the `html/` folder.
  function normalizeImagePath(path){
    if(!path) return '';
    // leave absolute URLs untouched
    if(path.startsWith('http://') || path.startsWith('https://') || path.startsWith('//')) return path;
    // if path already points from html/ (starts with ../) leave it
    if(path.startsWith('..')) return path;
    // if path is root-relative, convert to relative-from-html
    if(path.startsWith('/players/')) return '..' + path;
    // if path is a project-local players/... reference, prefix ../ so it resolves from html/
    if(path.startsWith('players/')) return '../' + path;
    return path;
  }

  function renderGrid(players){
    const grid = document.getElementById('grid');
    if(!grid) return;
    if(players.length === 0){ grid.innerHTML = '<p class="note">No players available.</p>'; return; }
    grid.innerHTML = players.map(p=>{
      const local = normalizeImagePath(`players/images/${p.id}.jpg`);
      const fetched = p._image || '';
      const explicit = normalizeImagePath(p.image || '');
      const src = fetched || explicit || local;
      const fallback = explicit || local;
      return `
      <a class="card" href="player.html?id=${encodeURIComponent(p.id)}">
        <img src="${src}" alt="${p.name}" onerror="this.onerror=null;this.src='${fallback}';">
        <div class="card-title">${p.name}</div>
      </a>
      `;
    }).join('');
  }

  function applyFilter(filter){
    const f = (filter || 'all').toString().toLowerCase();
    const players = allPlayers.slice();
    // If the dataset contains explicit `era` values, use them.
    const hasEra = players.some(p=> typeof p.era !== 'undefined');
    if(f === 'current'){
      // Treat players without an `era` as current, and also allow explicit `era: 'current'` entries
      renderGrid(players.filter(p=> !p.era || p.era.toString().toLowerCase() === 'current'));
    } else if(f === 'legend'){
      // Match legends by `era` or by `role` containing the word 'legend'
      const matches = players.filter(p=> {
        const eraMatch = p.era && p.era.toString().toLowerCase().includes('legend');
        const roleMatch = p.role && p.role.toString().toLowerCase().includes('legend');
        return eraMatch || roleMatch;
      });
      renderGrid(matches);
    } else if(f === 'managers'){
      // render managers as cards in the grid like players
      renderGridManagers(allManagers || []);
    } else if(f === 'trophies'){
      // render trophies as cards in the grid
      renderGridTrophies(allTrophies || []);
    } else {
      renderGrid(players);
    }
  }

  function renderGridManagers(managers){
    const grid = document.getElementById('grid');
    if(!grid) return;
    if(!managers || managers.length === 0){ grid.innerHTML = '<p class="note">No managers available.</p>'; return; }
    grid.innerHTML = managers.map(m=>{
      const local = normalizeImagePath(`players/images/${m.id}.jpg`);
      const fetched = m._image || '';
      const explicit = normalizeImagePath(m.image || '');
      const src = fetched || explicit || local;
      const fallback = explicit || local;
      return `
      <a class="card" href="manager.html?id=${encodeURIComponent(m.id)}">
        <img src="${src}" alt="${m.name}" onerror="this.onerror=null;this.src='${fallback}';">
        <div class="card-title">${m.name}</div>
      </a>
      `;
    }).join('');
  }

  function renderGridTrophies(trophies){
    const grid = document.getElementById('grid');
    if(!grid) return;
    if(!trophies || trophies.length === 0){ grid.innerHTML = '<p class="note">No trophies available.</p>'; return; }
    grid.innerHTML = trophies.map(t=>{
      const local = normalizeImagePath(t.image || `players/images/${t.id}.svg`);
      const src = t._image || local;
      const fallback = local;
      return `
      <a class="card" href="trophy.html?id=${encodeURIComponent(t.id)}">
        <img src="${src}" alt="${t.name}" onerror="this.onerror=null;this.src='${fallback}';">
        <div class="card-title">${t.name}</div>
      </a>
      `;
    }).join('');
  }

  function setupFilters(){
    const container = document.querySelector('.filters');
    if(!container) return;
    container.addEventListener('click', (e)=>{
      const btn = e.target.closest('button[data-filter]');
      if(!btn) return;
      container.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      applyFilter(btn.getAttribute('data-filter'));
    });
  }

  // Modal helpers for managers/trophies
  function openModal(title, html){
    const modal = document.getElementById('modal');
    if(!modal) return;
    const titleEl = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    titleEl.textContent = title || '';
    body.innerHTML = html || '';
    modal.setAttribute('aria-hidden','false');
    // attach close handler
    const closeBtn = document.getElementById('modal-close');
    if(closeBtn) closeBtn.onclick = closeModal;
    const backdrop = document.getElementById('modal-backdrop');
    if(backdrop) backdrop.onclick = closeModal;
  }

  function closeModal(){
    const modal = document.getElementById('modal');
    if(!modal) return;
    modal.setAttribute('aria-hidden','true');
  }

  function renderManagersList(managers){
    if(!managers || managers.length === 0){ openModal('Managers','<p class="note">No managers available.</p>'); return; }
    const html = [`<div class="manager-list">`];
    managers.forEach(m=>{
      const src = (m._image || m.image) || '';
      const img = src ? `<img src="${src}" alt="${m.name}" style="width:64px;height:64px;object-fit:cover;border-radius:6px;margin-right:10px;vertical-align:middle;">` : '';
      html.push(`<div class="manager-item" data-id="${m.id}">${img}<strong style="vertical-align:middle">${m.name}</strong><div class="detail-row">${m.from} — ${m.to || 'Present'}</div></div>`);
    });
    html.push(`</div>`);
    html.push(`<p class="note">Click a manager to view trophies and record.</p>`);
    openModal('Managers', html.join(''));
    // attach click handlers
    const body = document.getElementById('modal-body');
    body.querySelectorAll('.manager-item').forEach(el=>{
      el.addEventListener('click', ()=>{
        const id = el.getAttribute('data-id');
        const m = managers.find(x=>x.id===id);
        if(m) showManagerDetails(m);
      });
    });
  }

  function showManagerDetails(m){
    const trophyHtml = (m.trophies || []).map(t=>`<li><strong>${t.name}</strong>: ${t.count} — ${Array.isArray(t.years)?t.years.join(', '):''}</li>`).join('') || '<li>None listed</li>';
    const rec = m.record || {};
    const tenureYears = m.from ? ( (m.to ? (m.to - m.from + 1) : (new Date().getFullYear() - m.from + 1)) ) : null;
    const imgSrc = (m._image || m.image) || '';
    const imgHtml = imgSrc ? `<img src="${imgSrc}" alt="${m.name}" style="width:120px;height:120px;object-fit:cover;border-radius:8px;float:right;margin-left:12px">` : '';
    const html = `
      <div>
        ${imgHtml}
        <h4>${m.name}</h4>
        <div class="detail-row">Tenure: ${m.from} — ${m.to || 'Present'}${tenureYears? ' ('+tenureYears+' years)':''}</div>
        <div class="detail-row">Record: ${rec.wins||0}W • ${rec.draws||0}D • ${rec.losses||0}L</div>
        <h5 style="margin-top:12px">Trophies</h5>
        <ul>${trophyHtml}</ul>
        <div style="clear:both"></div>
      </div>
    `;
    openModal(m.name, html);
  }

  function renderTrophyList(trophies){
    if(!trophies || trophies.length === 0){ openModal('Trophies','<p class="note">No trophy data available.</p>'); return; }
    const rows = trophies.map(t=>{
      const yrs = Array.isArray(t.years) ? t.years.join(', ') : '';
      const src = t._image || t.image || '';
      const img = src ? `<img src="${src}" alt="${t.name}" style="width:56px;height:56px;object-fit:contain;border-radius:6px;margin-right:10px;vertical-align:middle">` : '';
      return `<div class="trophy-item">${img}<strong style="vertical-align:middle">${t.name}</strong><div class="detail-row">Count: ${t.count}</div><div class="detail-row">Years: ${yrs}</div></div>`;
    });
    const html = `<div class="trophy-list">${rows.join('')}</div>`;
    openModal('Trophies', html);
  }

  document.addEventListener('DOMContentLoaded', async ()=>{
    await ensureData();
    setupFilters();
    applyFilter('all');
    // close modal with Escape
    document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeModal(); });
  });

})();
