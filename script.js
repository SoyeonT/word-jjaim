document.addEventListener("DOMContentLoaded", async () => {
  (()=>{
  const DATA=window.WORD_DATA;
  const $=s=>document.querySelector(s); const $$=s=>[...document.querySelectorAll(s)];
  const screens={start:$('#startScreen'),game:$('#gameScreen'),result:$('#resultScreen')};
  const CLASS_KO={single:'단일어',compound:'합성어',derived:'파생어'};
  const STORE={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
  const ARCADE_RECORDS_KEY='morphArcadeRecent10V1';
  const ARCADE_TOTAL_KEY='morphArcadeTotalPlaysV1';
  function readArcadeRecords(){
   try{
    const parsed=JSON.parse(STORE.get(ARCADE_RECORDS_KEY)||'[]');
    if(!Array.isArray(parsed))return [];
    return parsed.filter(x=>x&&Number.isFinite(Number(x.score))&&Number.isFinite(Number(x.words))&&Number.isFinite(Number(x.playedAt))).map(x=>({
     score:Math.max(0,Math.round(Number(x.score))),
     words:Math.max(0,Math.round(Number(x.words))),
     playedAt:Number(x.playedAt)
    }));
   }catch(e){return []}
  }
  function readArcadeTotal(){
   const total=Number(STORE.get(ARCADE_TOTAL_KEY)||0);
   return Number.isFinite(total)&&total>=0?Math.floor(total):0;
  }
  function formatRecordTime(timestamp){
   const d=new Date(timestamp),pad=n=>String(n).padStart(2,'0');
   return `${d.getMonth()+1}.${d.getDate()}. ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function renderArcadeHistory(){
   const records=readArcadeRecords();
   const total=Math.max(readArcadeTotal(),records.length);
   const summary=$('#historySummary'),body=$('#historyBody');
   if(!summary||!body)return;
   summary.textContent=`누적 플레이 ${total.toLocaleString()}판 · 최근 10판 점수순`;
   if(!records.length){
    body.innerHTML='<tr><td colspan="3" class="history-empty">아직 저장된 아케이드 기록이 없습니다.</td></tr>';
    return;
   }
   const scoreOrder=[...records].sort((a,b)=>b.score-a.score||b.playedAt-a.playedAt);
   body.innerHTML=scoreOrder.map(record=>`<tr><td class="history-score">${record.score.toLocaleString()}점</td><td class="history-words">${record.words}개</td><td class="history-time">${formatRecordTime(record.playedAt)}</td></tr>`).join('');
  }
  function saveArcadeRecord(){
   if(st.mode!=='arcade'||st.arcadeRecordSaved)return;
   st.arcadeRecordSaved=true;
   const record={
    score:Math.max(0,Math.round(st.score)),
    words:Math.max(0,Math.round(st.round)),
    playedAt:Date.now()
   };
   const recentByTime=[record,...readArcadeRecords()]
    .sort((a,b)=>b.playedAt-a.playedAt)
    .slice(0,10);
   STORE.set(ARCADE_RECORDS_KEY,JSON.stringify(recentByTime));
   STORE.set(ARCADE_TOTAL_KEY,String(readArcadeTotal()+1));
   renderArcadeHistory();
  }
  let st={}; let timerId=null; let autoAdvanceId=null; let nextEnableId=null; let audioCtx=null;
  function clearFeedbackTimers(){clearTimeout(autoAdvanceId);clearTimeout(nextEnableId);autoAdvanceId=null;nextEnableId=null;}
  function resetState(mode, customItems=null){
   st={mode,score:0,combo:0,bestCombo:0,round:0,perfect:0,current:null,step:'class',stageFirst:true,stageWrongCount:0,roundPerfect:true,
   stats:{class:[0,0],morph:[0,0],type:[0,0]},wrongIds:new Set(),mis:{},history:[],customItems,
   startAt:Date.now(),deadline:mode==='arcade'?Date.now()+90000:null,timeExpired:false,paused:false,pauseStartedAt:null,pauseRemaining:0,arcadeRecordSaved:false,sound:STORE.get('morphSound')==='1'};
  }
  function show(name){Object.entries(screens).forEach(([k,v])=>v.classList.toggle('hidden',k!==name));}
  function fmt(n){return String(n).padStart(6,'0')}
  function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
  function beep(kind){if(!st.sound)return; try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.connect(g);g.connect(audioCtx.destination);o.type='square';o.frequency.value=kind==='ok'?620:kind==='combo'?820:180;g.gain.setValueAtTime(.035,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+.12);o.start();o.stop(audioCtx.currentTime+.12)}catch(e){}}
  function toast(t){const el=$('#toast');el.textContent=t;el.classList.remove('hidden');setTimeout(()=>el.classList.add('hidden'),900)}
  function sourcePool(){if(st.customItems)return st.customItems; if(st.mode==='practice')return DATA.filter(x=>x.difficulty===1&&x.pos==='명사'); const elapsed=(Date.now()-st.startAt)/1000; if(elapsed<28)return DATA.filter(x=>x.difficulty===1); if(elapsed<58)return DATA.filter(x=>x.difficulty<=2); return DATA.filter(x=>x.difficulty>=2)}
  function pickNext(){
   const pool=sourcePool(); const recent=st.history.slice(-5); let candidates=pool.filter(x=>!recent.includes(x.id)); if(!candidates.length)candidates=pool;
   const prev=st.current; const sameCount=prev?st.history.slice(-2).filter(id=>DATA.find(x=>x.id===id)?.linkKey===prev.linkKey).length:0;
   if(prev&&sameCount<2&&Math.random()<.68){const linked=candidates.filter(x=>x.linkKey===prev.linkKey&&x.id!==prev.id); if(linked.length)return linked[Math.floor(Math.random()*linked.length)];}
   if(prev&&sameCount>=2){const diff=candidates.filter(x=>x.linkKey!==prev.linkKey);if(diff.length)candidates=diff;}
   return candidates[Math.floor(Math.random()*candidates.length)];
  }
  function start(mode, customItems=null){clearInterval(timerId);clearFeedbackTimers();resetState(mode,customItems);show('game');$('#timerWrap').classList.toggle('hidden',mode==='practice');$('#modeLabel').textContent=mode==='practice'?'연습 모드 · 기본 10문항':'아케이드 모드 · 90초';$('#soundBtn').textContent=st.sound?'🔊 효과음':'🔇 효과음';updateHud(); if(mode==='arcade'){timerId=setInterval(tick,100);tick()} nextRound();}
  function pauseArcadeTimer(){if(st.mode!=='arcade'||st.paused||st.timeExpired)return;st.pauseRemaining=Math.max(0,st.deadline-Date.now());st.pauseStartedAt=Date.now();st.paused=true;tick();}
  function resumeArcadeTimer(){if(st.mode!=='arcade'||!st.paused)return;const pausedFor=Date.now()-st.pauseStartedAt;st.startAt+=pausedFor;st.deadline=Date.now()+st.pauseRemaining;st.paused=false;st.pauseStartedAt=null;tick();}
  function tick(){if(st.mode!=='arcade')return;const left=st.paused?st.pauseRemaining:Math.max(0,st.deadline-Date.now()),pct=left/90000;const bar=$('#timerBar');bar.style.width=(pct*100)+'%';bar.style.background=pct>.6?'#44e08f':pct>.3?'#ffc857':'#ff4d5a';bar.classList.toggle('danger',pct<=.3&&left>0);$('#timerLabel').textContent=st.paused?(left/1000).toFixed(1)+'초 · 해설':(left/1000).toFixed(1)+'초';if(!st.paused&&left<=0&&!st.timeExpired){st.timeExpired=true;clearInterval(timerId);toast('시간 종료! 현재 단어를 마무리하세요.');$('#timerLabel').textContent='TIME UP';}}
  function updateHud(){const best=Number(STORE.get('morphBest')||0);$('#score').textContent=fmt(st.score);$('#combo').textContent='×'+st.combo;$('#round').textContent=String(Math.max(1,st.round)).padStart(2,'0');$('#best').textContent=fmt(Math.max(best,st.score));$('#progressLabel').textContent=st.mode==='practice'?`${Math.min(st.round,10)} / 10`:'';}
  function sentenceHTML(item){if(!item.sentence)return '';const escaped=item.sentence.replaceAll('&','&amp;').replaceAll('<','&lt;');return escaped.replace(item.word,`<mark>${item.word}</mark>`)}
  function nextRound(){
   clearFeedbackTimers();
   if(st.mode==='practice'&&st.round>=10){return finish()}
   if(st.mode==='arcade'&&st.timeExpired&&st.round>0){return finish()}
   st.current=pickNext();st.round++;st.history.push(st.current.id);st.step='class';st.stageFirst=true;st.roundPerfect=true;
   $('#nextBtn').classList.add('hidden');$('#nextBtn').disabled=false;$('#nextBtn').textContent='다음 문제 ▶';$('#sentence').innerHTML=sentenceHTML(st.current);$('#word').textContent=st.current.word;$('#feedback').className='feedback';$('#feedback').innerHTML='단어를 보고 <strong>단일어인지 복합어인지</strong> 판단하세요.';
   const prev=st.history.length>1?DATA.find(x=>x.id===st.history.at(-2)):null;$('#linkBadge').textContent=prev&&prev.linkKey===st.current.linkKey?`${st.current.linkType} 연결!  ${st.current.linkKey} 다시 발견` : '';
   renderClass();updateHud();
  }
  function renderClass(){st.step='class';st.stageWrongCount=0;$('#prompt').textContent='이 단어는 단일어일까요, 복합어일까요?';renderChoices([{v:'single',t:'1  단일어'},{v:'complex',t:'2  복합어'}],(v,b)=>answerClass(v,b));}
  function renderChoices(opts,handler,analysis=false){const box=$('#choices');box.className='choices'+(analysis?' analysis':'');box.innerHTML='';opts.forEach((o,i)=>{const b=document.createElement('button');b.className='choice';b.dataset.value=o.v;b.innerHTML=o.t;b.addEventListener('click',()=>handler(o.v,b));box.appendChild(b)});}
  function markWrong(btn,msg,mis,correctValue){
   btn.classList.add('wrong');btn.disabled=true;st.stageWrongCount++;st.stageFirst=false;st.roundPerfect=false;st.combo=0;st.wrongIds.add(st.current.id);
   if(mis)st.mis[mis]=(st.mis[mis]||0)+1;
   beep('bad');updateHud();
   if(st.stageWrongCount<2){
     $('#feedback').className='feedback bad';
     $('#feedback').innerHTML=`✕ ${msg}<br><strong>한 번 더 선택할 수 있습니다.</strong>`;
     return;
   }
   $$('#choices .choice').forEach(b=>b.disabled=true);
   const correctBtn=$$('#choices .choice').find(b=>b.dataset.value===correctValue);
   if(correctBtn)correctBtn.classList.add('correct');
   $('#prompt').textContent='정답과 해설을 확인하세요.';
   showRoundFeedback();
   completeRound();
  }
  function lockCorrect(btn){$$('#choices .choice').forEach(b=>b.disabled=true);btn.classList.add('correct')}
  function earn(kind,base){st.stats[kind][1]++;if(st.stageFirst&&!st.timeExpired){st.stats[kind][0]++;const timeBonus=st.mode==='arcade'?Math.round(Math.max(0,(st.deadline-Date.now())/90000)*60):0;st.score+=base+timeBonus;}}
  function answerClass(v,btn){const correct=st.current.class==='single'?'single':'complex';if(v!==correct){const hasEnding=st.current.morphemes.some(x=>x.type==='어미');const msg=correct==='single'?(hasEnding?'형태소가 여러 개여도 어미는 짜임 판단에서 제외합니다.':'하나의 어근으로 이루어진 단어입니다.'):'둘 이상의 단어 구성 요소로 나눌 수 있습니다.';return markWrong(btn,msg,hasEnding?'형태소가 여러 개이면 복합어라고 판단함':'단일어·복합어 구분',correct)}
   lockCorrect(btn);earn('class',100);beep('ok');if(st.current.class==='single'){showRoundFeedback();completeRound()}else setTimeout(renderMorph,220);}
  function analysisText(item){return item.morphemes.map(x=>x.text).join(' + ')}
  function renderMorph(){st.step='morph';st.stageFirst=true;st.stageWrongCount=0;$('#prompt').textContent='형태소 분석으로 알맞은 것을 고르세요.';const correct=analysisText(st.current);const all=shuffle([{v:correct,t:correct},...st.current.wrongAnalyses.map(x=>({v:x,t:x}))]);const count=st.current.difficulty===1?3:4;let selected=all.slice(0,count);if(!selected.some(x=>x.v===correct))selected[selected.length-1]={v:correct,t:correct};renderChoices(shuffle(selected), (v,b)=>answerMorph(v,b),true);$('#feedback').className='feedback';$('#feedback').innerHTML='형태소의 경계를 확인하세요. 접사와 어미의 표기도 살펴보세요.';}
  function analysisParts(s){return s.split('+').map(x=>x.trim())}
  function stripEdgeHyphens(s){return s.replace(/^-+|-+$/g,'')}
  function isHyphenOnlyError(selected,correct){
   const a=analysisParts(selected),b=analysisParts(correct);
   return a.length===b.length&&a.every((x,i)=>stripEdgeHyphens(x)===stripEdgeHyphens(b[i]))&&selected!==correct;
  }
  function answerMorph(v,btn){const correct=analysisText(st.current);if(v!==correct){
   if(isHyphenOnlyError(v,correct))return markWrong(btn,'하이픈(-)이 어떤 경우에 쓰이는지 다시 생각해 보세요.','하이픈의 기능을 잘못 이해함',correct);
   const hasEnding=st.current.morphemes.some(x=>x.type==='어미');
   return markWrong(btn,hasEnding?'접사와 어미를 구별해 보세요. 어미는 활용할 때 붙습니다.':'어디까지가 뜻을 가진 가장 작은 단위인지 다시 살펴보세요.',hasEnding?'접사와 어미를 혼동함':'형태소 경계를 잘못 나눔',correct)}
   lockCorrect(btn);earn('morph',150);beep('ok');setTimeout(renderType,220);}
  function plainAnalysisVisual(item){return '<div class="morph-row">'+item.morphemes.map((m,i)=>`${i?'<span class="plus">+</span>':''}<span class="morph">${m.text}</span>`).join('')+'</div>'}
  function renderType(){st.step='type';st.stageFirst=true;st.stageWrongCount=0;$('#prompt').textContent='분석 결과, 이 복합어는 무엇일까요?';renderChoices([{v:'compound',t:'1  합성어'},{v:'derived',t:'2  파생어'}],(v,b)=>answerType(v,b));$('#feedback').className='feedback';$('#feedback').innerHTML=plainAnalysisVisual(st.current)+'<div class="principle">방금 확인한 형태소 분석을 바탕으로 판단해 보세요.</div>';}
  function answerType(v,btn){if(v!==st.current.class)return markWrong(btn,'각 부분이 어근인지 접사인지 다시 살펴보세요.','합성어·파생어 구분',st.current.class)
   lockCorrect(btn);earn('type',100);beep(st.roundPerfect?'combo':'ok');showRoundFeedback();completeRound();}
  function morphVisual(item){return '<div class="morph-row">'+item.morphemes.map((m,i)=>`${i?'<span class="plus">+</span>':''}<span class="morph ${m.counts?'':'excluded'}">${m.text}<small>${m.type}${m.counts?'':' · 짜임 제외'}</small></span>`).join('')+'</div>'}
  function showRoundFeedback(){if(st.mode==='arcade'&&st.roundPerfect){$('#feedback').className='feedback';$('#feedback').innerHTML='';return}const item=st.current;const type=CLASS_KO[item.class];const excluded=item.morphemes.some(x=>!x.counts);$('#feedback').className='feedback good';$('#feedback').innerHTML=`<strong>정답: ${type}</strong>${morphVisual(item)}<div>${item.note}</div>${excluded?'<div class="principle"><b>핵심:</b> 단어의 짜임을 판단할 때는 조사와 어미를 고려하지 않습니다.</div>':''}<div class="principle">품사 연결: 이 문장에서 ‘${item.word}’의 품사는 <b>${item.pos}</b>입니다.</div>`;}
  function advanceAfterFeedback(){if(st.step!=='feedback')return;clearFeedbackTimers();if(st.mode==='arcade'&&st.timeExpired)return finish();nextRound();}
  function completeRound(){
   const wasPerfect=st.roundPerfect;
   if(wasPerfect){st.perfect++;st.combo++;st.bestCombo=Math.max(st.bestCombo,st.combo)}else st.combo=0;
   updateHud();clearFeedbackTimers();
   const btn=$('#nextBtn');
   if(st.mode==='practice'){
     st.step='feedback';
     const lastPractice=st.round>=10;
     btn.classList.remove('hidden');btn.disabled=true;btn.textContent='해설을 잠시 읽어 보세요';
     nextEnableId=setTimeout(()=>{if(st.step!=='feedback')return;btn.disabled=false;btn.textContent=lastPractice?'결과 보기 ▶':'다음 문제 ▶';},1000);
     return;
   }
   btn.classList.add('hidden');
   if(wasPerfect){
     st.step='transition';
     autoAdvanceId=setTimeout(()=>st.timeExpired?finish():nextRound(),180);
     return;
   }
   st.step='feedback';
   autoAdvanceId=setTimeout(advanceAfterFeedback,2000);
  }
  function acc(x){return x[1]?Math.round(x[0]/x[1]*100):0}
  function finish(){clearInterval(timerId);clearFeedbackTimers();if(st.mode==='arcade'){const old=Number(STORE.get('morphBest')||0);if(st.score>old)STORE.set('morphBest',st.score);saveArcadeRecord()}show('result');$('#resultTitle').textContent=st.mode==='practice'?'연습 완료!':'아케이드 종료!';$('#resultScore').textContent=st.score.toLocaleString();$('#perfectStat').textContent=st.perfect;$('#comboStat').textContent='×'+st.bestCombo;$('#roundStat').textContent=st.round;$('#classAcc').textContent=acc(st.stats.class)+'%';$('#morphAcc').textContent=acc(st.stats.morph)+'%';$('#typeAcc').textContent=acc(st.stats.type)+'%';const top=Object.entries(st.mis).sort((a,b)=>b[1]-a[1])[0];$('#weakBox').innerHTML=top?`<strong>가장 많이 헷갈린 부분</strong><br>${top[0]} · ${top[1]}회`:'<strong>좋습니다!</strong><br>뚜렷한 오개념 없이 진행했습니다.';$('#wrongRetryBtn').classList.toggle('hidden',st.wrongIds.size===0);}
  $$('.mode').forEach(b=>b.onclick=()=>start(b.dataset.mode));$('#nextBtn').onclick=advanceAfterFeedback;$('#homeBtn').onclick=()=>{clearInterval(timerId);clearFeedbackTimers();show('start')};$('#resultHomeBtn').onclick=()=>show('start');$('#retryBtn').onclick=()=>start(st.mode);$('#wrongRetryBtn').onclick=()=>{const wrong=DATA.filter(x=>st.wrongIds.has(x.id));start('practice',wrong.length?wrong:null)};$('#soundBtn').onclick=()=>{st.sound=!st.sound;STORE.set('morphSound',st.sound?'1':'0');$('#soundBtn').textContent=st.sound?'🔊 효과음':'🔇 효과음';beep('ok')};
  document.addEventListener('keydown',e=>{if(screens.game.classList.contains('hidden'))return;const n=Number(e.key);if(n>=1&&n<=4){const btn=$$('#choices .choice')[n-1];if(btn&&!btn.disabled)btn.click()}const next=$('#nextBtn');if((e.key==='Enter'||e.key===' ')&&!next.classList.contains('hidden')&&!next.disabled){e.preventDefault();next.click()}});
  renderArcadeHistory();
  })();
});
