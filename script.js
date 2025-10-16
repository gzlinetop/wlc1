// script.js — Calculadora PWA básica
document.addEventListener('DOMContentLoaded', () => {
  const expressionEl = document.getElementById('expression');
  const resultEl = document.getElementById('result');
  const modalRoot = document.getElementById('modalRoot');
  const toastRoot = document.getElementById('toastRoot');
  const STORAGE_PREFIX = 'calc_';
  let expr = '0';
  let justEvaluated = false;
  let history = JSON.parse(localStorage.getItem(STORAGE_PREFIX + 'history') || '[]');

  function render() {
    expressionEl.textContent = expr;
    try {
      const val = safeEvaluate(expr);
      resultEl.textContent = formatNumber(val);
    } catch (e) {
      resultEl.textContent = '—';
    }
  }

  function showToast(msg, ms=1500){
    toastRoot.innerHTML = `<div class="toast">${msg}</div>`;
    toastRoot.classList.remove('hidden');
    setTimeout(()=>{ toastRoot.classList.add('hidden'); toastRoot.innerHTML=''; }, ms);
  }

  function safeEvaluate(input) {
    if(!input || typeof input !== 'string') return 0;
    let sanitized = input.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s+/g,'');
    sanitized = sanitized.replace(/(\d+(\.\d+)?)%/g, '($1/100)');
    if(!/^[0-9+\-*/().\s]+$/.test(sanitized)) throw new Error('Caracteres inválidos');
    if(sanitized.length > 200) throw new Error('Expresión muy larga');
    const fn = new Function('return ' + sanitized);
    const res = fn();
    if(typeof res === 'number' && isFinite(res)) return res;
    throw new Error('No numérico');
  }

  function formatNumber(n){
    if(typeof n !== 'number') return n;
    const s = String(Number(n.toFixed(12)));
    return s;
  }

  function appendValue(v){
    if(justEvaluated){
      if(/[0-9.]/.test(v)){
        expr = v === '.' ? '0.' : v;
        justEvaluated = false;
        render(); return;
      } else {
        justEvaluated = false;
      }
    }
    if(expr === '0' && /[0-9]/.test(v)){
      expr = v;
    } else {
      expr += v;
    }
    render();
  }

  function clearAll(){
    expr = '0';
    justEvaluated = false;
    render();
  }

  function backspace(){
    if(justEvaluated){
      expr = '0'; justEvaluated = false; render(); return;
    }
    if(expr.length <= 1){ expr = '0'; }
    else expr = expr.slice(0, -1);
    render();
  }

  function applyPercent(){
    if(justEvaluated){ expr = String(resultEl.textContent); justEvaluated=false; }
    if(!/[%]$/.test(expr)) expr += '%';
    render();
  }

  function evaluateExpression(){
    try {
      const value = safeEvaluate(expr);
      history.push({expr: expr, result: formatNumber(value), at: new Date().toISOString()});
      if(history.length > 50) history = history.slice(-50);
      localStorage.setItem(STORAGE_PREFIX + 'history', JSON.stringify(history));
      expr = String(formatNumber(value));
      justEvaluated = true;
      render();
    } catch (e) {
      showToast('Expresión inválida');
    }
  }

  document.querySelectorAll('.btn').forEach(btn=>{
    const v = btn.dataset.value;
    const action = btn.dataset.action;
    btn.addEventListener('click', (ev)=>{
      if(action === 'clear'){ clearAll(); return; }
      if(action === 'back'){ backspace(); return; }
      if(action === 'percent'){ applyPercent(); return; }
      if(action === 'equals'){ evaluateExpression(); return; }
      if(v !== undefined){ appendValue(v); return; }
    });
  });

  window.addEventListener('keydown', (e)=>{
    const key = e.key;
    if((/^[0-9]$/).test(key)){ appendValue(key); e.preventDefault(); return; }
    if(key === '.') { appendValue('.'); e.preventDefault(); return; }
    if(key === 'Enter' || key === '='){ evaluateExpression(); e.preventDefault(); return; }
    if(key === 'Backspace'){ backspace(); e.preventDefault(); return; }
    if(key === 'Escape'){ clearAll(); e.preventDefault(); return; }
    if(['+','-','*','/','(',')'].includes(key)){ appendValue(key); e.preventDefault(); return; }
    if(key === '%'){ applyPercent(); e.preventDefault(); return; }
  });

  document.getElementById('btnHistory').addEventListener('click', ()=>{
    const html = `
      <div style="max-height:320px;overflow:auto">
        ${history.slice().reverse().map(h=>`<div style="padding:8px;border-bottom:1px solid rgba(0,0,0,0.04)">
          <div style="font-weight:700">${escapeHtml(h.expr)}</div>
          <div class="sub">${escapeHtml(h.result)} • ${new Date(h.at).toLocaleString()}</div>
        </div>`).join('')}
      </div>
    `;
    showModal({title:'Historial', html, buttons:[
      {label:'Cerrar'},{label:'Borrar historial', onClick: ()=>{ history=[]; localStorage.removeItem(STORAGE_PREFIX + 'history'); showToast('Historial borrado'); closeModal(); }}
    ]});
  });

  function showModal({title='', html='', buttons=[]}){
    modalRoot.innerHTML = `<div class="modal-bg"><div class="modal"><div style="font-weight:700;margin-bottom:8px">${title}</div><div id="modalBody">${html}</div><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px" id="modalBtns"></div></div></div>`;
    modalRoot.classList.remove('hidden');
    modalRoot.setAttribute('aria-hidden','false');
    const btnArea = document.getElementById('modalBtns');
    buttons.forEach(btn=>{
      const b = document.createElement('button');
      b.className = 'icon-btn';
      b.textContent = btn.label;
      b.style.padding = '8px 12px';
      b.addEventListener('click', ()=>{ if(btn.onClick) btn.onClick(); if(btn.close !== false) closeModal(); });
      btnArea.appendChild(b);
    });
    const modalBg = modalRoot.querySelector('.modal-bg');
    modalBg.addEventListener('click', (ev)=>{ if(ev.target === modalBg) closeModal(); });
  }
  function closeModal(){ modalRoot.classList.add('hidden'); modalRoot.innerHTML = ''; modalRoot.setAttribute('aria-hidden','true'); }

  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  render();
  window._calc = { history };
});

// service worker registration (simple)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('./sw.js').then(function(reg) {
      console.log('Service Worker registrado:', reg.scope);
    }).catch(function(err) {
      console.warn('Service Worker registro falló:', err);
    });
  });
}
