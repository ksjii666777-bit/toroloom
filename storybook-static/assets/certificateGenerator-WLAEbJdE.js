import{i as e}from"./preload-helper-usAeo7Bx.js";import{A as t}from"./iframe-DPkEPn9P.js";import{c as n,s as r}from"./expo-modules-core-69FLyw__.js";var i,a=e((()=>{r(),i=n(`ExpoPrint`)}));async function o(e={}){return await i.printToFileAsync(e)}var s=e((()=>{r(),t(),a(),i.Orientation}));function c(e){let t=e.grade===`A`?`#FFD700`:e.grade===`B`?`#C0C0C0`:`#CD7F32`,n=e.grade===`A`?`with Distinction`:e.grade===`B`?`with Merit`:``;return`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { margin: 0; size: landscape; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      width: 1100px; height: 850px;
      background: #0D0D2B;
      display: flex; align-items: center; justify-content: center;
    }
    .certificate {
      width: 1040px; height: 790px;
      background: linear-gradient(135deg, #1A1A3E 0%, #222255 50%, #1A1A3E 100%);
      border: 3px solid #6C63FF;
      border-radius: 20px;
      position: relative;
      overflow: hidden;
      padding: 40px;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
    }
    /* Corner decorations */
    .corner { position: absolute; width: 120px; height: 120px; border-color: #6C63FF; }
    .corner-tl { top: 20px; left: 20px; border-top: 3px solid; border-left: 3px solid; border-radius: 12px 0 0 0; }
    .corner-tr { top: 20px; right: 20px; border-top: 3px solid; border-right: 3px solid; border-radius: 0 12px 0 0; }
    .corner-bl { bottom: 20px; left: 20px; border-bottom: 3px solid; border-left: 3px solid; border-radius: 0 0 0 12px; }
    .corner-br { bottom: 20px; right: 20px; border-bottom: 3px solid; border-right: 3px solid; border-radius: 0 0 12px 0; }
    /* Decorative line */
    .deco-line {
      width: 60%; height: 2px;
      background: linear-gradient(90deg, transparent, #6C63FF, transparent);
      margin: 10px 0;
    }
    .deco-line-thin {
      width: 40%; height: 1px;
      background: linear-gradient(90deg, transparent, rgba(108, 99, 255, 0.4), transparent);
      margin: 8px 0;
    }
    h1 {
      font-family: 'Georgia', serif;
      font-size: 42px;
      color: #FFD700;
      letter-spacing: 4px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .subtitle {
      font-size: 16px;
      color: rgba(255,255,255,0.6);
      letter-spacing: 6px;
      text-transform: uppercase;
      margin-bottom: 20px;
    }
    .awarded {
      font-size: 14px;
      color: rgba(255,255,255,0.7);
      letter-spacing: 2px;
      margin-bottom: 8px;
    }
    .recipient {
      font-size: 36px;
      color: #FFFFFF;
      font-weight: 700;
      font-family: 'Georgia', serif;
      margin-bottom: 4px;
    }
    .course-name {
      font-size: 22px;
      color: #6C63FF;
      font-weight: 700;
      margin-bottom: 12px;
      text-align: center;
      padding: 0 60px;
      line-height: 1.3;
    }
    .details {
      font-size: 13px;
      color: rgba(255,255,255,0.6);
      text-align: center;
      margin-bottom: 4px;
      line-height: 1.6;
    }
    .grade-badge {
      display: inline-block;
      background: ${t}22;
      color: ${t};
      border: 1px solid ${t}44;
      padding: 6px 20px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin: 10px 0;
    }
    .stats-row {
      display: flex;
      gap: 30px;
      margin: 12px 0;
    }
    .stat-item {
      text-align: center;
    }
    .stat-value {
      font-size: 20px;
      color: #FFFFFF;
      font-weight: 700;
    }
    .stat-label {
      font-size: 10px;
      color: rgba(255,255,255,0.5);
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .divider {
      width: 1px;
      height: 30px;
      background: rgba(255,255,255,0.15);
    }
    .serial {
      font-size: 10px;
      color: rgba(255,255,255,0.35);
      letter-spacing: 1px;
      margin-top: 16px;
    }
    .footer {
      position: absolute;
      bottom: 40px;
      left: 0; right: 0;
      text-align: center;
      font-size: 11px;
      color: rgba(255,255,255,0.3);
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="corner corner-tl"></div>
    <div class="corner corner-tr"></div>
    <div class="corner corner-bl"></div>
    <div class="corner corner-br"></div>

    <h1>Certificate</h1>
    <div class="deco-line-thin"></div>
    <div class="subtitle">of Completion</div>
    <div class="deco-line"></div>

    <div class="awarded">This is to certify that</div>
    <div class="recipient">${e.userName}</div>
    <div class="deco-line-thin"></div>
    <div class="awarded">has successfully completed the course</div>
    <div class="course-name">${e.courseTitle}</div>

    <div class="grade-badge">${n||`Completed`}</div>

    <div class="stats-row">
      <div class="stat-item">
        <div class="stat-value">${e.completedLessons} / ${e.totalLessons}</div>
        <div class="stat-label">Lessons</div>
      </div>
      ${e.quizPercent===void 0?``:`
      <div class="stat-item"><div style="width:1px;height:30px;background:rgba(255,255,255,0.15)"></div></div>
      <div class="stat-item">
        <div class="stat-value">${e.quizPercent}%</div>
        <div class="stat-label">Quiz Score</div>
      </div>`}
      <div class="stat-item"><div style="width:1px;height:30px;background:rgba(255,255,255,0.15)"></div></div>
      <div class="stat-item">
        <div class="stat-value">${new Date(e.issuedAt).toLocaleDateString(`en-IN`,{day:`numeric`,month:`long`,year:`numeric`})}</div>
        <div class="stat-label">Issued On</div>
      </div>
    </div>

    <div class="serial">Serial #${e.serialNumber}</div>
    <div class="footer">Toroloom — AI-Powered Trading &amp; Investment Platform</div>
  </div>
</body>
</html>`}async function l(e){try{let{uri:t}=await o({html:c(e),base64:!1,width:1100,height:850});return t}catch(e){return console.error(`[CertificateGenerator] Failed to generate PDF:`,e),null}}function u(){return f++,`TOR-${Date.now().toString(36).toUpperCase()}-${f.toString(36).toUpperCase().padStart(4,`0`)}-${Math.random().toString(36).substring(2,6).toUpperCase()}`}function d(e){return e===void 0?`C`:e>=90?`A`:e>=75?`B`:`C`}var f;e((()=>{s(),f=0}))();export{d as calculateGrade,l as generateCertificatePDF,u as generateSerialNumber};