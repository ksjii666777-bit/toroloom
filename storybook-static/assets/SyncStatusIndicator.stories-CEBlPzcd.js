import{c as e,i as t}from"./preload-helper-usAeo7Bx.js";import{A as n,F as r,Y as i,Z as a,a as o,at as s,i as c,mt as l,o as u,pt as d,r as f,s as p}from"./iframe-DPkEPn9P.js";import{n as m,t as h}from"./expo-vector-icons-i__6-MiG.js";import{d as g,f as _,i as v,n as y,p as b,r as x,t as S,u as C}from"./offlineMutationQueue-d7xHHXgK.js";import{n as w,r as T,t as E}from"./analytics-AHNlY8dR.js";async function D(e){let t=v.getState(),n=Date.now();t.setSyncing(!0),t.computeSyncStatus();let r=await y.processViaSyncApi(),i=Date.now()-n,a=r.filter(e=>e.success),o=r.filter(e=>!e.success),s=await y.getAll(),c=new Map;for(let e of s){let t=c.get(e.type)||{count:0,oldest:null};t.count++,(!t.oldest||e.enqueuedAt<t.oldest)&&(t.oldest=e.enqueuedAt),c.set(e.type,t)}let l=Array.from(c.entries()).map(([e,t])=>({type:e,count:t.count,oldestAt:t.oldest}));t.setPendingGroups(l,s.length);let u=a.length>0&&o.length===0?`success`:a.length>0?`partial`:`failed`;return t.recordSyncAttempt({timestamp:new Date().toISOString(),durationMs:i,result:u,syncedCount:a.length,failedCount:o.length,error:u===`failed`?o.map(e=>e.error).filter(Boolean).join(`; `):void 0}),t.setSyncResult(u),t.setSyncing(!1),t.computeSyncStatus(),E.logEvent(`connectivity_restored`,{reconnectedAt:new Date().toISOString(),offlineDurationMs:i,mutationsSynced:a.length,storesRefreshed:a.length>0}).catch(()=>{}),g.info(`[BackgroundSync] Cycle complete`,{source:e,durationMs:i,synced:a.length,failed:o.length,conflicts:o.length,remaining:s.length,result:u}),{syncedCount:a.length,failedCount:o.length,conflictCount:0}}var O=t((()=>{l(),T(),x(),S(),C(),w()}));function k(){let e=b(),t=v(e=>e.syncStatus),n=v(e=>e.pendingTotal),o=v(e=>e.conflicts),c=v(e=>e.freshness),l=v(e=>e.isSyncing),u=v(e=>e.computeSyncStatus),d=v(e=>e.refreshFreshness),[f,p]=(0,A.useState)(!1),m=(0,A.useRef)(new i.Value(1)).current,g=(0,A.useRef)(new i.Value(0)).current,_=M[t]||M.online,y=o.filter(e=>e.status===`pending`).length;(0,A.useEffect)(()=>{if(_.pulse){let e=i.loop(i.sequence([i.timing(m,{toValue:.4,duration:800,useNativeDriver:!0}),i.timing(m,{toValue:1,duration:800,useNativeDriver:!0})]));return e.start(),()=>e.stop()}else m.setValue(1)},[_.pulse,m]),(0,A.useEffect)(()=>{if(t===`syncing`){let e=i.loop(i.timing(g,{toValue:1,duration:1500,useNativeDriver:!0}));return e.start(),()=>e.stop()}else g.setValue(0)},[t,g]);let x=g.interpolate({inputRange:[0,1],outputRange:[`0deg`,`360deg`]}),[S,C]=(0,A.useState)(0),[w,T]=(0,A.useState)(null);(0,A.useEffect)(()=>{let e=Object.values(c),t=e.filter(e=>e.isStale).length;C(t),T(e.map(e=>e.ageLabel).filter(e=>e!==`never`&&e!==`just now`).sort((e,t)=>(parseInt(t)||0)-(parseInt(e)||0))[0]||null)},[c]);let E=(0,A.useCallback)(()=>{f||(d(),u()),p(e=>!e)},[f,d,u]),O=(0,A.useCallback)(async()=>{p(!1),await D(`manual`),await d(),u()},[d,u]),k=t===`offline`?`Offline`:t===`conflict`?`${y} conflict${y===1?``:`s`}`:t===`syncing`?`Syncing`:n>0?`${n} pending`:`All synced`;return(0,j.jsxs)(s,{style:[P.container,{top:e.top+4,zIndex:f?9999:9990}],pointerEvents:`box-none`,children:[(0,j.jsxs)(r,{onPress:E,style:({pressed:e})=>[[P.pill,{backgroundColor:_.bgColor,borderColor:_.borderColor}],{opacity:e?.7:1}],children:[(0,j.jsx)(i.View,{style:[P.iconContainer,{opacity:m},t===`syncing`&&{transform:[{rotate:x}]}],children:(0,j.jsx)(h,{name:_.icon,size:12,color:_.color})}),(0,j.jsx)(a,{style:[P.label,{color:_.color}],children:k}),(0,j.jsx)(h,{name:f?`chevron-up`:`chevron-down`,size:10,color:_.color,style:{opacity:.6}})]}),f&&(0,j.jsxs)(s,{style:[P.dropdown,{backgroundColor:`rgba(15, 23, 42, 0.95)`,borderColor:`rgba(255,255,255,0.08)`}],children:[(0,j.jsxs)(s,{style:P.syncSummaryRow,children:[(0,j.jsxs)(s,{style:P.summaryLeft,children:[(0,j.jsx)(h,{name:t===`offline`?`cloud-offline`:`cloud-done`,size:14,color:_.color}),(0,j.jsx)(a,{style:[P.summaryText,{color:_.color}],children:t===`offline`?`You're offline — viewing cached data`:n>0?`${n} mutation${n===1?``:`s`} pending`:`All data synced`})]}),n>0&&!l&&(0,j.jsxs)(r,{onPress:O,style:P.syncNowBtn,children:[(0,j.jsx)(h,{name:`sync-outline`,size:11,color:`#0D0D0D`}),(0,j.jsx)(a,{style:P.syncNowText,children:`Sync`})]})]}),(0,j.jsx)(s,{style:P.freshnessMiniGrid,children:Object.entries(N).map(([e,t])=>{let n=c[e];if(!n)return null;let r=n.ageLabel===`never`?`#EF4444`:n.isStale?`#FFAB40`:`#22C55E`;return(0,j.jsxs)(s,{style:P.freshnessRow,children:[(0,j.jsx)(h,{name:t.icon,size:10,color:r}),(0,j.jsx)(a,{style:[P.freshnessLabel,{color:r}],children:t.label}),(0,j.jsx)(a,{style:[P.freshnessTime,{color:r}],children:n.ageLabel})]},e)})}),S>0&&(0,j.jsxs)(s,{style:P.warningRow,children:[(0,j.jsx)(h,{name:`information-circle`,size:10,color:`#FFAB40`}),(0,j.jsxs)(a,{style:P.warningText,children:[S,` stale`]})]}),y>0&&(0,j.jsxs)(s,{style:[P.warningRow,{borderColor:`rgba(249, 115, 22, 0.3)`}],children:[(0,j.jsx)(h,{name:`warning`,size:10,color:`#F97316`}),(0,j.jsxs)(a,{style:[P.warningText,{color:`#F97316`}],children:[y,` conflict`,y===1?``:`s`,` — tap banner to resolve`]})]})]})]})}var A,j,M,N,P,F=t((()=>{A=e(l()),n(),m(),_(),x(),O(),p(),j=f(),M={online:{color:`#22C55E`,bgColor:`rgba(34, 197, 94, 0.1)`,borderColor:`rgba(34, 197, 94, 0.2)`,icon:`checkmark-circle`,label:`All synced`,pulse:!1},pending:{color:`#FFAB40`,bgColor:`rgba(255, 171, 64, 0.1)`,borderColor:`rgba(255, 171, 64, 0.2)`,icon:`sync-outline`,label:`Pending`,pulse:!1},syncing:{color:`#60A5FA`,bgColor:`rgba(96, 165, 250, 0.1)`,borderColor:`rgba(96, 165, 250, 0.2)`,icon:`sync`,label:`Syncing...`,pulse:!0},offline:{color:`#EF4444`,bgColor:`rgba(239, 68, 68, 0.1)`,borderColor:`rgba(239, 68, 68, 0.2)`,icon:`cloud-offline`,label:`Offline`,pulse:!1},conflict:{color:`#F97316`,bgColor:`rgba(249, 115, 22, 0.1)`,borderColor:`rgba(249, 115, 22, 0.2)`,icon:`warning`,label:`Conflicts`,pulse:!1}},N={portfolio:{icon:`pie-chart`,label:`Portfolio`},market:{icon:`trending-up`,label:`Market`},watchlist:{icon:`heart`,label:`Watchlist`},education:{icon:`school`,label:`Courses`},openOrders:{icon:`document-text`,label:`Orders`},fno:{icon:`git-network`,label:`F&O`},community:{icon:`people`,label:`Community`},aiInsights:{icon:`bulb`,label:`AI`}},P=d.create({container:{position:`absolute`,alignSelf:`center`},pill:{flexDirection:`row`,alignItems:`center`,gap:4,paddingHorizontal:10,paddingVertical:4,borderRadius:c.full,borderWidth:1},iconContainer:{width:14,height:14,justifyContent:`center`,alignItems:`center`},label:{...o.semiBold,fontSize:10,letterSpacing:.3},dropdown:{marginTop:6,borderRadius:c.lg,borderWidth:1,padding:u.md,width:240,alignSelf:`center`,shadowColor:`#000`,shadowOffset:{width:0,height:8},shadowOpacity:.4,shadowRadius:16,elevation:16},syncSummaryRow:{flexDirection:`row`,alignItems:`center`,justifyContent:`space-between`,marginBottom:u.sm},summaryLeft:{flexDirection:`row`,alignItems:`center`,gap:6,flex:1},summaryText:{...o.regular,fontSize:10,flex:1},syncNowBtn:{flexDirection:`row`,alignItems:`center`,gap:3,backgroundColor:`#60A5FA`,paddingHorizontal:8,paddingVertical:3,borderRadius:c.full},syncNowText:{...o.semiBold,fontSize:9,color:`#0D0D0D`},freshnessMiniGrid:{gap:3,marginBottom:u.xs},freshnessRow:{flexDirection:`row`,alignItems:`center`,gap:4},freshnessLabel:{...o.regular,fontSize:9,width:55},freshnessTime:{...o.semiBold,fontSize:9},warningRow:{flexDirection:`row`,alignItems:`center`,gap:4,marginTop:u.xs,paddingTop:u.xs,borderTopWidth:1,borderColor:`rgba(255,255,255,0.06)`},warningText:{...o.regular,fontSize:9,color:`#FFAB40`,flex:1}}),k.__docgenInfo={description:``,methods:[],displayName:`SyncStatusIndicator`}}));function I(e){return()=>((0,L.useEffect)(()=>(v.setState(e),()=>{v.setState({pendingTotal:0,isSyncing:!1,lastSyncResult:null,conflicts:[],syncStatus:`online`})}),[]),(0,R.jsx)(k,{}))}var L,R,z,B,V,H,U,W,G;t((()=>{L=e(l()),F(),x(),R=f(),z={title:`UI/SyncStatusIndicator`,component:k,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:`SyncStatusIndicator — a persistent pill-like indicator showing the current\r
sync/offline status at a glance. Smaller than the full OfflineBanner, it\r
provides always-visible awareness of connectivity and data freshness.\r

Status colors:\r
  - Green  → Online, all synced\r
  - Yellow → Pending mutations waiting to sync\r
  - Red    → Offline — viewing cached data\r
  - Blue   → Syncing in progress\r
  - Orange → Conflicts detected — needs user action`}}}},B={name:`Online — All Synced`,render:I({pendingTotal:0,isSyncing:!1,lastSyncResult:`success`,conflicts:[],syncStatus:`online`})},V={name:`Pending Mutations`,render:I({pendingTotal:3,isSyncing:!1,lastSyncResult:null,conflicts:[],syncStatus:`pending`})},H={name:`Syncing...`,render:I({pendingTotal:5,isSyncing:!0,lastSyncResult:null,conflicts:[],syncStatus:`syncing`})},U={name:`Offline`,render:I({pendingTotal:0,isSyncing:!1,lastSyncResult:null,conflicts:[],syncStatus:`offline`})},W={name:`Conflicts`,render:I({pendingTotal:2,isSyncing:!1,lastSyncResult:`failed`,conflicts:[{id:`c1`,mutationType:`BUY_STOCK`,status:`pending`,error:`409 Conflict`}],syncStatus:`conflict`})},B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  name: 'Online — All Synced',
  render: withStore({
    pendingTotal: 0,
    isSyncing: false,
    lastSyncResult: 'success',
    conflicts: [],
    syncStatus: 'online' as const
  })
}`,...B.parameters?.docs?.source}}},V.parameters={...V.parameters,docs:{...V.parameters?.docs,source:{originalSource:`{
  name: 'Pending Mutations',
  render: withStore({
    pendingTotal: 3,
    isSyncing: false,
    lastSyncResult: null,
    conflicts: [],
    syncStatus: 'pending' as const
  })
}`,...V.parameters?.docs?.source}}},H.parameters={...H.parameters,docs:{...H.parameters?.docs,source:{originalSource:`{
  name: 'Syncing...',
  render: withStore({
    pendingTotal: 5,
    isSyncing: true,
    lastSyncResult: null,
    conflicts: [],
    syncStatus: 'syncing' as const
  })
}`,...H.parameters?.docs?.source}}},U.parameters={...U.parameters,docs:{...U.parameters?.docs,source:{originalSource:`{
  name: 'Offline',
  render: withStore({
    pendingTotal: 0,
    isSyncing: false,
    lastSyncResult: null,
    conflicts: [],
    syncStatus: 'offline' as const
  })
}`,...U.parameters?.docs?.source}}},W.parameters={...W.parameters,docs:{...W.parameters?.docs,source:{originalSource:`{
  name: 'Conflicts',
  render: withStore({
    pendingTotal: 2,
    isSyncing: false,
    lastSyncResult: 'failed',
    conflicts: [{
      id: 'c1',
      mutationType: 'BUY_STOCK',
      status: 'pending' as const,
      error: '409 Conflict'
    }],
    syncStatus: 'conflict' as const
  })
}`,...W.parameters?.docs?.source}}},G=[`Online`,`Pending`,`Syncing`,`Offline`,`Conflicts`]}))();export{W as Conflicts,U as Offline,B as Online,V as Pending,H as Syncing,G as __namedExportsOrder,z as default};