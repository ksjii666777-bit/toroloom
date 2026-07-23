import{c as e,i as t}from"./preload-helper-usAeo7Bx.js";import{A as n,D as r,E as i,F as a,S as o,Z as s,a as c,at as l,i as u,mt as d,o as f,pt as p,r as m,s as h,v as ee,x as te,y as g,z as ne}from"./iframe-DPkEPn9P.js";import{a as _,i as re,n as v,r as y,t as b}from"./expo-haptics-D0S3b9a9.js";import{n as ie,t as x}from"./expo-vector-icons-i__6-MiG.js";import{a as ae,d as S,f as C,i as w,n as T,o as oe,p as se,r as E,t as D,u as O}from"./offlineMutationQueue-d7xHHXgK.js";import{i as k,n as A,r as j,t as ce}from"./analytics-AHNlY8dR.js";import{n as le,t as M}from"./portfolioStore-CYoxdClz.js";import{n as N,t as ue}from"./watchlistStore-Yg8eV7Hz.js";import{a as de,c as P,i as F,l as I,n as fe,o as L,r as R,s as z,t as pe,u as me}from"./aiStore-Co8GVVAF.js";function he(){let e=k(e=>e.isOnline),t=k(e=>e.isChecking),n=k(e=>e.lastCheckedAt),r=k(e=>e.refresh),i=k(e=>e.combinedOffline);return(0,B.useEffect)(()=>k.getState().startPolling(),[]),{isOnline:e,isChecking:t,lastCheckedAt:n,combinedOffline:i,refresh:r}}var B,ge=t((()=>{B=e(d()),j()}));async function V(){try{return(await Promise.allSettled([le.getState().refreshPortfolio(),N.getState().fetchWatchlists(),me.getState().refreshMarket(),P.getState().fetchCourses(),L.getState().fetchPositions(),L.getState().fetchSpotPrices(),F.getState().fetchPosts(),fe.getState().fetchInsights()])).some(e=>e.status===`fulfilled`)}catch(e){return S.warn(`[OfflineBanner] refreshAllStores error:`,e),!1}}function _e(e,t){return t===`just now`?`#22C55E`:t===`never`?`#EF4444`:e?`#FFAB40`:`#60A5FA`}function H(){let e=se(),{combinedOffline:t,refresh:n}=he(),[c,u]=(0,U.useState)(!1),d=(0,U.useRef)(0),p=(0,U.useRef)(0),[m,h]=(0,U.useState)(0),[g,re]=(0,U.useState)(!1),[ie,ae]=(0,U.useState)(!1),[C,E]=(0,U.useState)(null),D=(0,U.useRef)(null),O=w(e=>e.freshness),A=w(e=>e.refreshFreshness),j=w(e=>e.markSynced),le=w(e=>e.setPendingGroups),M=Object.values(O).filter(e=>e.isStale).length,N=(0,U.useCallback)((e,t=`success`)=>{D.current&&clearTimeout(D.current),E({message:e,type:t}),D.current=setTimeout(()=>{E(null),D.current=null},3e3)},[]);(0,U.useEffect)(()=>{A()},[,A]),(0,U.useEffect)(()=>k.getState().onReconnect(async()=>{let e=Date.now();if(e-p.current<ye){S.info(`[OfflineBanner] Reconnect debounced — skipping refresh`);return}p.current=e,_(v.Success);try{w.getState().setSyncing(!0);let e=await T.processAll(),t=e.filter(e=>e.success).length;h(await T.getCount()),t>0&&(j(`portfolio`),j(`watchlist`));let n=await V();await A();let{reconnectedAt:r,wentOfflineAt:i}=k.getState(),a=i?r?r.getTime()-i.getTime():Date.now()-i.getTime():0;ce.logEvent(`connectivity_restored`,{reconnectedAt:r?.toISOString()||new Date().toISOString(),offlineDurationMs:a,mutationsSynced:t,storesRefreshed:n}).catch(()=>{});let o=e.filter(e=>!e.success).length;S.info(`[OfflineBanner] Connectivity restored`,{reconnectedAt:r,offlineDurationMs:a,mutationsSynced:t,mutationsFailed:o,storesRefreshed:n}),w.getState().setSyncing(!1),o>0&&t>0?N(`${t} synced \u2022 ${o} failed`,`error`):o>0?N(`${o} mutation${o===1?``:`s`} failed to sync`,`error`):t>0&&n?N(`${t} mutation${t===1?``:`s`} synced \u2022 Data refreshed`,`success`):t>0?N(`${t} mutation${t===1?``:`s`} synced \u2713`,`success`):n&&N(`Data refreshed ✓`,`success`)}catch(e){S.warn(`[OfflineBanner] Auto-refresh on reconnect failed:`,e),w.getState().setSyncing(!1)}}),[N,j,A]),(0,U.useEffect)(()=>{let e=!0,t=async()=>{if(!e)return;let t=await T.getAll(),n=t.length;e&&h(n);let r=new Map;for(let e of t){let t=r.get(e.type)||{count:0,oldest:null};t.count++,(!t.oldest||e.enqueuedAt<t.oldest)&&(t.oldest=e.enqueuedAt),r.set(e.type,t)}let i=Array.from(r.entries()).map(([e,t])=>({type:e,count:t.count,oldestAt:t.oldest}));e&&(le(i,n),await A())};t();let n=setInterval(t,8e3);return()=>{e=!1,clearInterval(n)}},[le,A]);let ue=t||m>0;(0,U.useEffect)(()=>{!t&&m===0&&c&&u(!1)},[t,m,c]);let de=(0,U.useCallback)(()=>c?Date.now()-d.current<ve:!1,[c]),P=ue&&!de(),F=o(-80),I=o(0);(0,U.useEffect)(()=>{P?(F.value=i(0,{stiffness:120,damping:14}),I.value=r(1,{duration:300})):(F.value=i(-80,{stiffness:120,damping:14}),I.value=r(0,{duration:200}))},[P,F,I]);let fe=te(()=>({transform:[{translateY:F.value}],opacity:I.value})),[L,R]=(0,U.useState)(!1),z=async()=>{y(b.Medium),re(!0),w.getState().setSyncing(!0);try{let e=await T.processAll(),t=await T.getCount();h(t);let n=e.filter(e=>e.success).length,r=e.filter(e=>!e.success).length;n>0&&(j(`portfolio`),j(`watchlist`),await A()),w.getState().setSyncResult(r>0?`partial`:`success`),t===0?(_(v.Success),N(`${n} mutation${n===1?``:`s`} synced \u2713`,`success`)):r>0&&N(`${r} still pending`,`error`)}catch{w.getState().setSyncResult(`failed`)}finally{re(!1),w.getState().setSyncing(!1)}},pe=async()=>{y(b.Medium),R(!0);try{await n(),await V()?(j(`market`),j(`portfolio`),j(`watchlist`),j(`education`),j(`fno`),j(`community`),j(`aiInsights`),await A(),_(v.Success)):_(v.Error)}catch{}finally{R(!1)}},me=()=>{y(b.Light),d.current=Date.now(),u(!0)},B=(0,U.useCallback)(async()=>{if(C?.type===`error`){y(b.Medium),D.current&&clearTimeout(D.current),E(null);try{let e=await T.processAll(),t=e.filter(e=>e.success).length,n=e.filter(e=>!e.success).length;h(await T.getCount()),await V(),await A(),n>0&&t>0?N(`${t} synced \u2022 ${n} still failed`,`error`):n>0?N(`${n} mutation${n===1?``:`s`} still failed`,`error`):t>0&&N(`${t} mutation${t===1?``:`s`} synced \u2713`,`success`)}catch{N(`Retry failed — network error`,`error`)}}},[C?.type,N,A]),ge=(0,U.useCallback)(()=>{D.current&&clearTimeout(D.current),E(null)},[]);if((0,U.useEffect)(()=>()=>{D.current&&clearTimeout(D.current)},[]),!P&&!C)return null;let H=t?`#FFAB40`:m>0?`#60A5FA`:`#22C55E`;return(0,W.jsxs)(W.Fragment,{children:[P&&(0,W.jsxs)(ee.View,{style:[G.container,fe,{top:e.top+4,left:f.md,right:f.md}],children:[(0,W.jsxs)(a,{onPress:()=>ae(e=>!e),style:({pressed:e})=>[G.mainRow,{opacity:e?.7:1}],children:[(0,W.jsx)(l,{style:[G.statusDot,{backgroundColor:H}]}),(0,W.jsxs)(l,{style:G.textContainer,children:[(0,W.jsx)(s,{style:G.title,children:t?`You're offline`:m>0?`${m} change${m===1?``:`s`} pending`:`All synced`}),(0,W.jsx)(s,{style:G.subtitle,children:t?`Viewing cached data`:m>0?`Waiting for network to sync`:`All data is up to date`})]}),(0,W.jsxs)(l,{style:G.actionsRow,children:[!g&&!L&&(0,W.jsxs)(W.Fragment,{children:[m>0&&(0,W.jsx)(a,{onPress:z,style:G.syncBtn,hitSlop:8,children:(0,W.jsx)(x,{name:`sync-outline`,size:13,color:`#0D0D0D`})}),(0,W.jsx)(a,{onPress:pe,style:G.refreshBtn,hitSlop:8,children:(0,W.jsx)(x,{name:`refresh-outline`,size:13,color:`#0D0D0D`})})]}),(g||L)&&(0,W.jsx)(l,{style:G.syncBtn,children:(0,W.jsx)(ne,{size:`small`,color:`#0D0D0D`})}),(0,W.jsx)(a,{onPress:me,style:G.dismissBtn,hitSlop:8,children:(0,W.jsx)(x,{name:`close`,size:14,color:`rgba(255,255,255,0.5)`})})]})]}),ie&&(0,W.jsxs)(l,{style:G.freshnessSection,children:[(0,W.jsx)(l,{style:G.freshnessDivider}),(0,W.jsx)(s,{style:G.freshnessTitle,children:`Data Freshness`}),(0,W.jsx)(l,{style:G.freshnessGrid,children:Object.entries(be).map(([e,t])=>{let n=O[e],r=_e(n.isStale,n.ageLabel);return(0,W.jsxs)(l,{style:G.freshnessItem,children:[(0,W.jsx)(x,{name:t.icon,size:12,color:r,style:{marginRight:4}}),(0,W.jsxs)(l,{style:G.freshnessTextCol,children:[(0,W.jsx)(s,{style:G.freshnessLabel,children:t.label}),(0,W.jsx)(s,{style:[G.freshnessAge,{color:r}],children:n.ageLabel})]}),(0,W.jsx)(l,{style:[G.freshnessDot,{backgroundColor:r}]})]},e)})}),M>0&&(0,W.jsxs)(l,{style:G.staleWarning,children:[(0,W.jsx)(x,{name:`information-circle`,size:12,color:`#FFAB40`}),(0,W.jsxs)(s,{style:G.staleWarningText,children:[M,` data set`,M===1?``:`s`,` stale — pull to refresh`]})]}),m>0&&(0,W.jsxs)(l,{style:G.pendingSection,children:[(0,W.jsx)(l,{style:G.freshnessDivider}),(0,W.jsx)(s,{style:G.freshnessTitle,children:`Pending Sync`}),(0,W.jsxs)(a,{style:({pressed:e})=>[G.syncAllBtn,e&&{opacity:.7}],onPress:z,disabled:g,children:[(0,W.jsx)(x,{name:`sync-outline`,size:14,color:`#0D0D0D`}),(0,W.jsx)(s,{style:G.syncAllText,children:g?`Syncing...`:`Sync ${m} pending`})]})]}),(0,W.jsx)(l,{style:G.freshnessDivider}),(0,W.jsxs)(a,{style:({pressed:e})=>[G.cacheRow,e&&{opacity:.6}],onPress:async()=>{await oe.clearAll(),await A(),_(v.Success),N(`Cache cleared`,`info`)},children:[(0,W.jsx)(x,{name:`trash-outline`,size:13,color:`#EF4444`}),(0,W.jsx)(s,{style:G.cacheClearText,children:`Clear offline cache`})]})]})]}),C&&(0,W.jsx)(ee.View,{style:[G.toastOuter,{top:e.top+4,left:f.md,right:f.md}],children:(0,W.jsxs)(l,{style:[G.toastContainer,C.type===`success`&&G.toastSuccess,C.type===`error`&&G.toastError],children:[(0,W.jsxs)(a,{onPress:B,disabled:C.type!==`error`,style:({pressed:e})=>[G.toastContent,e&&{opacity:.7}],children:[(0,W.jsx)(x,{name:C.type===`success`?`checkmark-circle`:C.type===`error`?`alert-circle`:`information-circle`,size:14,color:C.type===`success`?`#22C55E`:C.type===`error`?`#EF4444`:`#60A5FA`}),(0,W.jsx)(s,{style:[G.toastText,C.type===`success`&&G.toastTextSuccess,C.type===`error`&&G.toastTextError],children:C.message}),C.type===`error`&&(0,W.jsx)(x,{name:`refresh-outline`,size:11,color:`#EF4444`,style:{marginLeft:2}})]}),`              `,(0,W.jsx)(a,{onPress:ge,hitSlop:6,children:(0,W.jsx)(x,{name:`close`,size:12,color:`rgba(255,255,255,0.4)`})})]})})]})}var U,W,ve,ye,be,G,xe=t((()=>{U=e(d()),n(),g(),ie(),C(),re(),ge(),j(),E(),M(),ue(),I(),z(),de(),R(),pe(),D(),ae(),O(),A(),h(),W=m(),ve=1800*1e3,ye=5e3,be={portfolio:{icon:`pie-chart`,label:`Portfolio`},market:{icon:`trending-up`,label:`Market`},watchlist:{icon:`heart`,label:`Watchlist`},education:{icon:`school`,label:`Courses`},openOrders:{icon:`document-text`,label:`Orders`},fno:{icon:`git-network`,label:`F&O`},community:{icon:`people`,label:`Community`},aiInsights:{icon:`bulb`,label:`AI Insights`}},G=p.create({container:{position:`absolute`,zIndex:9999,backgroundColor:`rgba(255, 171, 64, 0.12)`,borderWidth:1,borderColor:`rgba(255, 171, 64, 0.25)`,borderRadius:u.lg,paddingVertical:f.sm,paddingHorizontal:f.md,shadowColor:`#000`,shadowOffset:{width:0,height:4},shadowOpacity:.3,shadowRadius:8,elevation:8},mainRow:{flexDirection:`row`,alignItems:`center`,gap:f.sm},statusDot:{width:8,height:8,borderRadius:4},textContainer:{flex:1},title:{...c.semiBold,fontSize:c.size.sm,color:`#FFAB40`},subtitle:{...c.regular,fontSize:c.size.xs,color:`rgba(255,255,255,0.7)`,marginTop:1},actionsRow:{flexDirection:`row`,alignItems:`center`,gap:6},refreshBtn:{width:28,height:28,borderRadius:14,backgroundColor:`rgba(255, 171, 64, 0.25)`,borderWidth:1,borderColor:`rgba(255, 171, 64, 0.4)`,justifyContent:`center`,alignItems:`center`},syncBtn:{width:28,height:28,borderRadius:14,backgroundColor:`#FFAB40`,justifyContent:`center`,alignItems:`center`},dismissBtn:{width:24,height:24,borderRadius:12,backgroundColor:`rgba(255,255,255,0.08)`,justifyContent:`center`,alignItems:`center`},freshnessSection:{marginTop:f.sm,paddingTop:f.xs},freshnessDivider:{height:1,backgroundColor:`rgba(255,255,255,0.08)`,marginVertical:f.sm},freshnessTitle:{...c.semiBold,fontSize:c.size.xs,color:`rgba(255,255,255,0.6)`,marginBottom:f.sm,textTransform:`uppercase`,letterSpacing:.5},freshnessGrid:{gap:6},freshnessItem:{flexDirection:`row`,alignItems:`center`},freshnessTextCol:{flex:1,flexDirection:`row`,alignItems:`center`,gap:6},freshnessLabel:{...c.regular,fontSize:c.size.xs,color:`rgba(255,255,255,0.8)`},freshnessAge:{...c.semiBold,fontSize:c.size.xs},freshnessDot:{width:6,height:6,borderRadius:3},staleWarning:{flexDirection:`row`,alignItems:`center`,gap:4,marginTop:f.sm},staleWarningText:{...c.regular,fontSize:c.size.xs,color:`#FFAB40`,flex:1},pendingSection:{marginTop:f.xs},syncAllBtn:{flexDirection:`row`,alignItems:`center`,justifyContent:`center`,gap:6,backgroundColor:`#FFAB40`,paddingVertical:f.sm,borderRadius:u.md},syncAllText:{...c.semiBold,fontSize:c.size.xs,color:`#0D0D0D`},cacheRow:{flexDirection:`row`,alignItems:`center`,gap:6,paddingVertical:f.xs},cacheClearText:{...c.regular,fontSize:c.size.xs,color:`#EF4444`},toastOuter:{position:`absolute`,zIndex:9998},toastContainer:{flexDirection:`row`,alignItems:`center`,gap:6,paddingVertical:f.xs,paddingHorizontal:f.md,borderRadius:u.md,backgroundColor:`rgba(255,255,255,0.06)`},toastSuccess:{backgroundColor:`rgba(34, 197, 94, 0.12)`},toastError:{backgroundColor:`rgba(239, 68, 68, 0.12)`},toastContent:{flex:1,flexDirection:`row`,alignItems:`center`,gap:6},toastText:{flex:1,...c.regular,fontSize:c.size.xs,color:`rgba(255,255,255,0.8)`},toastTextSuccess:{color:`#22C55E`},toastTextError:{color:`#EF4444`}}),H.__docgenInfo={description:``,methods:[],displayName:`OfflineBanner`}}));function K(e){return()=>((0,Se.useEffect)(()=>(e(),()=>{k.setState({combinedOffline:!1,reconnectedAt:null,wentOfflineAt:null,onReconnect:()=>()=>{}}),w.setState({freshness:{portfolio:{isStale:!1,ageLabel:`just now`,lastSyncedAt:new Date().toISOString()},market:{isStale:!1,ageLabel:`just now`,lastSyncedAt:new Date().toISOString()},watchlist:{isStale:!1,ageLabel:`just now`,lastSyncedAt:new Date().toISOString()},education:{isStale:!1,ageLabel:`just now`,lastSyncedAt:new Date().toISOString()},openOrders:{isStale:!1,ageLabel:`just now`,lastSyncedAt:new Date().toISOString()},fno:{isStale:!1,ageLabel:`just now`,lastSyncedAt:new Date().toISOString()},community:{isStale:!1,ageLabel:`just now`,lastSyncedAt:new Date().toISOString()},aiInsights:{isStale:!1,ageLabel:`just now`,lastSyncedAt:new Date().toISOString()}},conflicts:[],pendingTotal:0,pendingGroups:[],isSyncing:!1,lastSyncResult:null,setSyncing:()=>{},setPendingGroups:()=>{},setSyncResult:()=>{},markSynced:()=>{},refreshFreshness:async()=>{},resolveConflict:()=>{},clearResolvedConflicts:()=>{},computeSyncStatus:()=>{}})}),[]),(0,Ce.jsx)(H,{}))}var Se,Ce,we,q,J,Y,Te,X,Z,Q,$,Ee;t((()=>{Se=e(d()),xe(),j(),E(),Ce=m(),we={title:`UI/OfflineBanner`,component:H,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:`OfflineBanner — an animated status bar that appears when the app is\r
offline or has pending mutations. Shows data freshness per store,\r
pending mutation count, and allows manual sync / refresh.\r

This component is self-contained (reads from Zustand stores). The stories\r
below mock store state to simulate different scenarios.`}}}},q=new Date().toISOString(),J=new Date(Date.now()-3e5).toISOString(),Y=new Date(Date.now()-18e5).toISOString(),Te=new Date(Date.now()-72e5).toISOString(),X={name:`Offline State`,render:K(()=>{k.setState({combinedOffline:!0,reconnectedAt:null,wentOfflineAt:new Date,onReconnect:()=>()=>{}}),w.setState({freshness:{portfolio:{isStale:!1,ageLabel:`2 min ago`,lastSyncedAt:J},market:{isStale:!0,ageLabel:`30 min ago`,lastSyncedAt:Y},watchlist:{isStale:!1,ageLabel:`just now`,lastSyncedAt:q},education:{isStale:!0,ageLabel:`2 hours ago`,lastSyncedAt:Te},openOrders:{isStale:!1,ageLabel:`5 min ago`,lastSyncedAt:J},fno:{isStale:!0,ageLabel:`30 min ago`,lastSyncedAt:Y},community:{isStale:!1,ageLabel:`just now`,lastSyncedAt:q},aiInsights:{isStale:!1,ageLabel:`2 min ago`,lastSyncedAt:J}},pendingTotal:0,pendingGroups:[],isSyncing:!1,lastSyncResult:null,syncStatus:`online`})})},Z={name:`Pending Mutations`,render:K(()=>{k.setState({combinedOffline:!1,reconnectedAt:new Date,wentOfflineAt:new Date(Date.now()-6e5),onReconnect:()=>()=>{}}),w.setState({freshness:{portfolio:{isStale:!0,ageLabel:`10 min ago`,lastSyncedAt:J},market:{isStale:!1,ageLabel:`just now`,lastSyncedAt:q},watchlist:{isStale:!1,ageLabel:`just now`,lastSyncedAt:q},education:{isStale:!1,ageLabel:`just now`,lastSyncedAt:q},openOrders:{isStale:!1,ageLabel:`5 min ago`,lastSyncedAt:J},fno:{isStale:!1,ageLabel:`just now`,lastSyncedAt:q},community:{isStale:!1,ageLabel:`just now`,lastSyncedAt:q},aiInsights:{isStale:!1,ageLabel:`just now`,lastSyncedAt:q}},pendingTotal:3,pendingGroups:[{type:`BUY_STOCK`,count:2,oldestAt:new Date(Date.now()-12e4).toISOString()},{type:`ADD_TO_WATCHLIST`,count:1,oldestAt:new Date(Date.now()-6e4).toISOString()}],isSyncing:!1,lastSyncResult:null,syncStatus:`pending`})})},Q={name:`Syncing`,render:K(()=>{k.setState({combinedOffline:!1,reconnectedAt:new Date,wentOfflineAt:new Date(Date.now()-6e5),onReconnect:()=>()=>{}}),w.setState({freshness:{portfolio:{isStale:!0,ageLabel:`15 min ago`,lastSyncedAt:new Date(Date.now()-9e5).toISOString()},market:{isStale:!0,ageLabel:`15 min ago`,lastSyncedAt:new Date(Date.now()-9e5).toISOString()},watchlist:{isStale:!0,ageLabel:`15 min ago`,lastSyncedAt:new Date(Date.now()-9e5).toISOString()},education:{isStale:!1,ageLabel:`just now`,lastSyncedAt:q},openOrders:{isStale:!1,ageLabel:`5 min ago`,lastSyncedAt:J},fno:{isStale:!1,ageLabel:`just now`,lastSyncedAt:q},community:{isStale:!1,ageLabel:`just now`,lastSyncedAt:q},aiInsights:{isStale:!1,ageLabel:`just now`,lastSyncedAt:q}},pendingTotal:5,pendingGroups:[{type:`BUY_STOCK`,count:3,oldestAt:new Date(Date.now()-18e4).toISOString()},{type:`SELL_STOCK`,count:2,oldestAt:new Date(Date.now()-12e4).toISOString()}],isSyncing:!0,lastSyncResult:null,syncStatus:`syncing`})})},$={name:`All Synced`,render:K(()=>{k.setState({combinedOffline:!1,reconnectedAt:new Date,wentOfflineAt:null,onReconnect:()=>()=>{}}),w.setState({freshness:{portfolio:{isStale:!1,ageLabel:`just now`,lastSyncedAt:q},market:{isStale:!1,ageLabel:`just now`,lastSyncedAt:q},watchlist:{isStale:!1,ageLabel:`just now`,lastSyncedAt:q},education:{isStale:!1,ageLabel:`just now`,lastSyncedAt:q},openOrders:{isStale:!1,ageLabel:`just now`,lastSyncedAt:q},fno:{isStale:!1,ageLabel:`just now`,lastSyncedAt:q},community:{isStale:!1,ageLabel:`just now`,lastSyncedAt:q},aiInsights:{isStale:!1,ageLabel:`just now`,lastSyncedAt:q}},pendingTotal:0,pendingGroups:[],isSyncing:!1,lastSyncResult:null,syncStatus:`online`})})},X.parameters={...X.parameters,docs:{...X.parameters?.docs,source:{originalSource:`{
  name: 'Offline State',
  render: withStore(() => {
    useConnectivityStore.setState({
      combinedOffline: true,
      reconnectedAt: null,
      wentOfflineAt: new Date(),
      onReconnect: () => () => {}
    });
    useOfflineStore.setState({
      freshness: {
        portfolio: {
          isStale: false,
          ageLabel: '2 min ago',
          lastSyncedAt: fiveMinAgo
        },
        market: {
          isStale: true,
          ageLabel: '30 min ago',
          lastSyncedAt: thirtyMinAgo
        },
        watchlist: {
          isStale: false,
          ageLabel: 'just now',
          lastSyncedAt: now
        },
        education: {
          isStale: true,
          ageLabel: '2 hours ago',
          lastSyncedAt: twoHoursAgo
        },
        openOrders: {
          isStale: false,
          ageLabel: '5 min ago',
          lastSyncedAt: fiveMinAgo
        },
        fno: {
          isStale: true,
          ageLabel: '30 min ago',
          lastSyncedAt: thirtyMinAgo
        },
        community: {
          isStale: false,
          ageLabel: 'just now',
          lastSyncedAt: now
        },
        aiInsights: {
          isStale: false,
          ageLabel: '2 min ago',
          lastSyncedAt: fiveMinAgo
        }
      },
      pendingTotal: 0,
      pendingGroups: [],
      isSyncing: false,
      lastSyncResult: null,
      syncStatus: 'online'
    } as any);
  })
}`,...X.parameters?.docs?.source}}},Z.parameters={...Z.parameters,docs:{...Z.parameters?.docs,source:{originalSource:`{
  name: 'Pending Mutations',
  render: withStore(() => {
    useConnectivityStore.setState({
      combinedOffline: false,
      reconnectedAt: new Date(),
      wentOfflineAt: new Date(Date.now() - 600_000),
      onReconnect: () => () => {}
    });
    useOfflineStore.setState({
      freshness: {
        portfolio: {
          isStale: true,
          ageLabel: '10 min ago',
          lastSyncedAt: fiveMinAgo
        },
        market: {
          isStale: false,
          ageLabel: 'just now',
          lastSyncedAt: now
        },
        watchlist: {
          isStale: false,
          ageLabel: 'just now',
          lastSyncedAt: now
        },
        education: {
          isStale: false,
          ageLabel: 'just now',
          lastSyncedAt: now
        },
        openOrders: {
          isStale: false,
          ageLabel: '5 min ago',
          lastSyncedAt: fiveMinAgo
        },
        fno: {
          isStale: false,
          ageLabel: 'just now',
          lastSyncedAt: now
        },
        community: {
          isStale: false,
          ageLabel: 'just now',
          lastSyncedAt: now
        },
        aiInsights: {
          isStale: false,
          ageLabel: 'just now',
          lastSyncedAt: now
        }
      },
      pendingTotal: 3,
      pendingGroups: [{
        type: 'BUY_STOCK',
        count: 2,
        oldestAt: new Date(Date.now() - 120_000).toISOString()
      }, {
        type: 'ADD_TO_WATCHLIST',
        count: 1,
        oldestAt: new Date(Date.now() - 60_000).toISOString()
      }],
      isSyncing: false,
      lastSyncResult: null,
      syncStatus: 'pending'
    } as any);
  })
}`,...Z.parameters?.docs?.source}}},Q.parameters={...Q.parameters,docs:{...Q.parameters?.docs,source:{originalSource:`{
  name: 'Syncing',
  render: withStore(() => {
    useConnectivityStore.setState({
      combinedOffline: false,
      reconnectedAt: new Date(),
      wentOfflineAt: new Date(Date.now() - 600_000),
      onReconnect: () => () => {}
    });
    useOfflineStore.setState({
      freshness: {
        portfolio: {
          isStale: true,
          ageLabel: '15 min ago',
          lastSyncedAt: new Date(Date.now() - 900_000).toISOString()
        },
        market: {
          isStale: true,
          ageLabel: '15 min ago',
          lastSyncedAt: new Date(Date.now() - 900_000).toISOString()
        },
        watchlist: {
          isStale: true,
          ageLabel: '15 min ago',
          lastSyncedAt: new Date(Date.now() - 900_000).toISOString()
        },
        education: {
          isStale: false,
          ageLabel: 'just now',
          lastSyncedAt: now
        },
        openOrders: {
          isStale: false,
          ageLabel: '5 min ago',
          lastSyncedAt: fiveMinAgo
        },
        fno: {
          isStale: false,
          ageLabel: 'just now',
          lastSyncedAt: now
        },
        community: {
          isStale: false,
          ageLabel: 'just now',
          lastSyncedAt: now
        },
        aiInsights: {
          isStale: false,
          ageLabel: 'just now',
          lastSyncedAt: now
        }
      },
      pendingTotal: 5,
      pendingGroups: [{
        type: 'BUY_STOCK',
        count: 3,
        oldestAt: new Date(Date.now() - 180_000).toISOString()
      }, {
        type: 'SELL_STOCK',
        count: 2,
        oldestAt: new Date(Date.now() - 120_000).toISOString()
      }],
      isSyncing: true,
      lastSyncResult: null,
      syncStatus: 'syncing'
    } as any);
  })
}`,...Q.parameters?.docs?.source}}},$.parameters={...$.parameters,docs:{...$.parameters?.docs,source:{originalSource:`{
  name: 'All Synced',
  render: withStore(() => {
    useConnectivityStore.setState({
      combinedOffline: false,
      reconnectedAt: new Date(),
      wentOfflineAt: null,
      onReconnect: () => () => {}
    });
    useOfflineStore.setState({
      freshness: {
        portfolio: {
          isStale: false,
          ageLabel: 'just now',
          lastSyncedAt: now
        },
        market: {
          isStale: false,
          ageLabel: 'just now',
          lastSyncedAt: now
        },
        watchlist: {
          isStale: false,
          ageLabel: 'just now',
          lastSyncedAt: now
        },
        education: {
          isStale: false,
          ageLabel: 'just now',
          lastSyncedAt: now
        },
        openOrders: {
          isStale: false,
          ageLabel: 'just now',
          lastSyncedAt: now
        },
        fno: {
          isStale: false,
          ageLabel: 'just now',
          lastSyncedAt: now
        },
        community: {
          isStale: false,
          ageLabel: 'just now',
          lastSyncedAt: now
        },
        aiInsights: {
          isStale: false,
          ageLabel: 'just now',
          lastSyncedAt: now
        }
      },
      pendingTotal: 0,
      pendingGroups: [],
      isSyncing: false,
      lastSyncResult: null,
      syncStatus: 'online'
    } as any);
  })
}`,...$.parameters?.docs?.source}}},Ee=[`OfflineState`,`PendingMutations`,`SyncingState`,`AllSynced`]}))();export{$ as AllSynced,X as OfflineState,Z as PendingMutations,Q as SyncingState,Ee as __namedExportsOrder,we as default};