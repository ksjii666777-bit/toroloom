import{c as e,i as t}from"./preload-helper-usAeo7Bx.js";import{A as n,D as r,E as i,F as a,S as o,Z as s,a as c,at as l,b as ee,i as u,mt as d,o as f,pt as p,r as m,rt as h,s as g,tt as te,v as _,x as v,y}from"./iframe-DPkEPn9P.js";import{a as b,i as x,n as ne,r as S,t as C}from"./expo-haptics-D0S3b9a9.js";import{n as w,t as T}from"./expo-vector-icons-i__6-MiG.js";import{n as E,t as re}from"./expo-linear-gradient-D-UA3GB3.js";import{f as D,i as O,n as k,p as A,r as j,t as M}from"./offlineMutationQueue-d7xHHXgK.js";function N(e){try{let t=new Date(e),n=new Date().getTime()-t.getTime();return n<6e4?`just now`:n<36e5?`${Math.round(n/6e4)}m ago`:t.toLocaleDateString(`en-IN`,{day:`numeric`,month:`short`,hour:`2-digit`,minute:`2-digit`})}catch{return`unknown`}}function P(e){if(!e)return``;let t=[];return e.symbol&&t.push(String(e.symbol)),e.quantity&&t.push(`Qty: ${e.quantity}`),e.price&&t.push(`₹${Number(e.price).toLocaleString(`en-IN`)}`),t.join(` · `)}function F(){let e=A(),t=O(e=>e.conflicts),n=(0,I.useMemo)(()=>t.filter(e=>e.status===`pending`),[t]),c=O(e=>e.resolveConflict),u=O(e=>e.computeSyncStatus),d=O(e=>e.refreshFreshness),f=O(e=>e.clearResolvedConflicts),[m,h]=(0,I.useState)(!1),[g,y]=(0,I.useState)(null),x=(0,I.useRef)(n.length);(0,I.useEffect)(()=>{n.length>0&&n.length>x.current&&h(!0),x.current=n.length},[n.length]);let w=o(0),E=o(.85),D=o(80);(0,I.useEffect)(()=>{m?(w.value=r(1,{duration:300}),E.value=i(1,{stiffness:100,damping:14}),D.value=i(0,{stiffness:100,damping:14}),b(ne.Warning)):(w.value=r(0,{duration:250}),E.value=r(.85,{duration:200}),D.value=r(80,{duration:200}))},[m,w,E,D]);let j=v(()=>({opacity:w.value})),M=v(()=>({opacity:ee(E.value,[.85,1],[0,1]),transform:[{scale:E.value},{translateY:D.value}]})),F=(0,I.useCallback)(async(e,n)=>{if(S(C.Light),y(e),c(e,n),n===`resolved_use_server`||n===`dismissed`){let n=t.find(t=>t.id===e);n&&await k.remove(n.mutationId)}y(null),u()},[t,c,u]),R=(0,I.useCallback)(async()=>{S(C.Medium);let e=n;for(let t of e)c(t.id,`dismissed`),await k.remove(t.mutationId);await d(),u(),h(!1)},[n,c,d,u]),V=(0,I.useCallback)(async()=>{S(C.Medium);let e=n;for(let t of e)c(t.id,`resolved_use_server`);await k.processAll(),await d(),u(),f(),h(!1)},[n,c,d,u,f]),H=(0,I.useCallback)(()=>{S(C.Light),h(!1),u()},[u]);return!m||n.length===0?null:(0,L.jsxs)(l,{style:B.root,pointerEvents:`auto`,children:[(0,L.jsx)(a,{style:({pressed:e})=>[p.absoluteFill,{opacity:1}],onPress:H,children:(0,L.jsx)(_.View,{style:[B.backdrop,j]})}),(0,L.jsx)(_.View,{style:[B.modalContainer,{paddingTop:e.top+40,paddingBottom:e.bottom+20},M],children:(0,L.jsxs)(re,{colors:[`#0F172A`,`#1E293B`],start:{x:0,y:0},end:{x:1,y:1},style:B.modalGradient,children:[(0,L.jsxs)(l,{style:B.header,children:[(0,L.jsxs)(l,{style:B.headerLeft,children:[(0,L.jsx)(l,{style:B.iconCircle,children:(0,L.jsx)(T,{name:`warning`,size:22,color:`#F97316`})}),(0,L.jsxs)(l,{children:[(0,L.jsx)(s,{style:B.title,children:`Sync Conflicts`}),(0,L.jsxs)(s,{style:B.subtitle,children:[n.length,` mutation`,n.length===1?``:`s`,` failed to sync`]})]})]}),(0,L.jsx)(a,{onPress:H,style:B.closeBtn,children:(0,L.jsx)(T,{name:`close`,size:18,color:`rgba(255,255,255,0.5)`})})]}),(0,L.jsx)(te,{style:B.scrollArea,showsVerticalScrollIndicator:!1,children:n.map(e=>(0,L.jsxs)(l,{style:B.conflictCard,children:[(0,L.jsxs)(l,{style:B.conflictHeader,children:[(0,L.jsxs)(l,{style:B.conflictTypeBadge,children:[(0,L.jsx)(T,{name:e.mutationType.startsWith(`BUY`)||e.mutationType.startsWith(`SELL`)?`swap-horizontal`:`bookmark`,size:12,color:`#F97316`}),(0,L.jsx)(s,{style:B.conflictTypeText,children:z[e.mutationType]||e.mutationType})]}),(0,L.jsx)(s,{style:B.conflictTime,children:N(e.enqueuedAt)})]}),e.localPayload&&(0,L.jsx)(s,{style:B.payloadText,children:P(e.localPayload)}),(0,L.jsxs)(l,{style:B.errorBox,children:[(0,L.jsx)(T,{name:`information-circle`,size:10,color:`#EF4444`}),(0,L.jsx)(s,{style:B.errorText,children:e.error})]}),(0,L.jsxs)(l,{style:B.resolutionRow,children:[(0,L.jsx)(a,{style:[B.resolveBtn,B.resolveDismiss],onPress:()=>F(e.id,`dismissed`),disabled:g===e.id,children:(0,L.jsx)(s,{style:B.resolveDismissText,children:`Dismiss`})}),(0,L.jsxs)(a,{style:[B.resolveBtn,B.resolveRetry],onPress:()=>F(e.id,`resolved_use_server`),disabled:g===e.id,children:[(0,L.jsx)(T,{name:`refresh-outline`,size:11,color:`#22C55E`}),(0,L.jsx)(s,{style:B.resolveRetryText,children:`Retry`})]}),(0,L.jsxs)(a,{style:[B.resolveBtn,B.resolveKeep],onPress:()=>F(e.id,`resolved_keep_local`),disabled:g===e.id,children:[(0,L.jsx)(T,{name:`checkmark-outline`,size:11,color:`#3B82F6`}),(0,L.jsx)(s,{style:B.resolveKeepText,children:`Keep`})]})]})]},e.id))}),(0,L.jsxs)(l,{style:B.bulkActions,children:[(0,L.jsx)(a,{style:B.bulkDismissBtn,onPress:R,children:(0,L.jsx)(s,{style:B.bulkDismissText,children:`Dismiss All`})}),(0,L.jsxs)(a,{style:B.bulkRetryBtn,onPress:V,children:[(0,L.jsx)(T,{name:`refresh-outline`,size:14,color:`#0D0D0D`}),(0,L.jsx)(s,{style:B.bulkRetryText,children:`Retry All`})]})]}),(0,L.jsx)(s,{style:B.footnote,children:`Conflicts occur when your local data is older than the server version. Choose "Keep" to preserve your local changes, "Retry" to re-send, or "Dismiss" to discard.`})]})})]})}var I,L,R,z,B,V=t((()=>{I=e(d()),n(),y(),E(),w(),D(),x(),j(),M(),g(),L=m(),{width:R}=h.get(`window`),z={BUY_STOCK:`Buy Order`,SELL_STOCK:`Sell Order`,ADD_TO_WATCHLIST:`Add to Watchlist`,REMOVE_FROM_WATCHLIST:`Remove from Watchlist`,CREATE_WATCHLIST:`Create Watchlist`,DELETE_WATCHLIST:`Delete Watchlist`,MODIFY_ORDER:`Modify Order`,CANCEL_ORDER:`Cancel Order`},B=p.create({root:{...p.absoluteFill,zIndex:9998,elevation:9998,justifyContent:`center`,alignItems:`center`},backdrop:{...p.absoluteFill,backgroundColor:`rgba(0, 0, 0, 0.7)`},modalContainer:{width:R*.9,maxWidth:420,maxHeight:`80%`,borderRadius:u.xl,overflow:`hidden`,shadowColor:`#000`,shadowOffset:{width:0,height:12},shadowOpacity:.5,shadowRadius:32,elevation:24},modalGradient:{padding:f.lg},header:{flexDirection:`row`,alignItems:`flex-start`,justifyContent:`space-between`,marginBottom:f.lg},headerLeft:{flexDirection:`row`,alignItems:`center`,gap:f.md,flex:1},iconCircle:{width:44,height:44,borderRadius:22,backgroundColor:`rgba(249, 115, 22, 0.15)`,justifyContent:`center`,alignItems:`center`},title:{...c.bold,fontSize:c.size.xl,color:`#FFFFFF`},subtitle:{...c.regular,fontSize:c.size.sm,color:`rgba(255,255,255,0.6)`,marginTop:2},closeBtn:{width:32,height:32,borderRadius:16,backgroundColor:`rgba(255,255,255,0.08)`,justifyContent:`center`,alignItems:`center`},scrollArea:{maxHeight:320,marginBottom:f.md},conflictCard:{backgroundColor:`rgba(255,255,255,0.04)`,borderRadius:u.md,borderWidth:1,borderColor:`rgba(255,255,255,0.06)`,padding:f.md,marginBottom:f.sm},conflictHeader:{flexDirection:`row`,alignItems:`center`,justifyContent:`space-between`,marginBottom:f.xs},conflictTypeBadge:{flexDirection:`row`,alignItems:`center`,gap:4,backgroundColor:`rgba(249, 115, 22, 0.1)`,paddingHorizontal:6,paddingVertical:2,borderRadius:u.xs},conflictTypeText:{...c.semiBold,fontSize:c.size.xs,color:`#F97316`},conflictTime:{...c.regular,fontSize:c.size.xs,color:`rgba(255,255,255,0.4)`},payloadText:{...c.medium,fontSize:c.size.xs,color:`rgba(255,255,255,0.7)`,marginBottom:f.xs},errorBox:{flexDirection:`row`,alignItems:`flex-start`,gap:4,backgroundColor:`rgba(239, 68, 68, 0.08)`,borderRadius:u.xs,paddingHorizontal:6,paddingVertical:4,marginBottom:f.sm},errorText:{...c.regular,fontSize:c.size.xs,color:`#EF4444`,flex:1},resolutionRow:{flexDirection:`row`,gap:6},resolveBtn:{flex:1,flexDirection:`row`,alignItems:`center`,justifyContent:`center`,gap:3,paddingVertical:5,borderRadius:u.xs,borderWidth:1},resolveDismiss:{borderColor:`rgba(255,255,255,0.15)`},resolveDismissText:{...c.semiBold,fontSize:c.size.xs,color:`rgba(255,255,255,0.6)`},resolveRetry:{borderColor:`rgba(34, 197, 94, 0.3)`,backgroundColor:`rgba(34, 197, 94, 0.08)`},resolveRetryText:{...c.semiBold,fontSize:c.size.xs,color:`#22C55E`},resolveKeep:{borderColor:`rgba(59, 130, 246, 0.3)`,backgroundColor:`rgba(59, 130, 246, 0.08)`},resolveKeepText:{...c.semiBold,fontSize:c.size.xs,color:`#3B82F6`},bulkActions:{flexDirection:`row`,gap:f.sm,marginBottom:f.md},bulkDismissBtn:{flex:1,alignItems:`center`,paddingVertical:f.sm,borderRadius:u.md,borderWidth:1,borderColor:`rgba(255,255,255,0.12)`},bulkDismissText:{...c.semiBold,fontSize:c.size.sm,color:`rgba(255,255,255,0.6)`},bulkRetryBtn:{flex:1,flexDirection:`row`,alignItems:`center`,justifyContent:`center`,gap:6,paddingVertical:f.sm,borderRadius:u.md,backgroundColor:`#22C55E`},bulkRetryText:{...c.semiBold,fontSize:c.size.sm,color:`#0D0D0D`},footnote:{...c.regular,fontSize:c.size.xs,color:`rgba(255,255,255,0.35)`,textAlign:`center`,lineHeight:16}}),F.__docgenInfo={description:``,methods:[],displayName:`SyncConflictModal`}}));function H(e,t,n,r,i,a,o){return{id:e,mutationId:`mut_${e}`,mutationType:t,localPayload:{symbol:n,quantity:r,price:i},serverPayload:null,error:a,enqueuedAt:new Date(Date.now()-o*6e4).toISOString(),status:`pending`}}function U(e){(0,W.useEffect)(()=>(O.setState({conflicts:e,pendingTotal:e.length,syncing:!1,syncResult:null,refreshFreshness:async()=>{},resolveConflict:(e,t)=>{O.setState({conflicts:O.getState().conflicts.map(n=>n.id===e?{...n,status:t}:n)})},computeSyncStatus:()=>{},clearResolvedConflicts:()=>{}}),()=>{O.setState({conflicts:[],pendingCount:0})}),[e])}var W,G,K,q,J,Y,X,Z,Q,$;t((()=>{W=e(d()),n(),V(),j(),g(),w(),G=m(),K={title:`UI/SyncConflictModal`,component:F,tags:[`autodocs`],parameters:{layout:`fullscreen`,docs:{description:{component:`SyncConflictModal — a full-screen modal that appears when offline mutations\r
fail to sync due to data conflicts (409 Conflict, version mismatch, etc.).\r

Lets the user review each failed mutation and choose to keep local changes,\r
retry (use server), or dismiss.\r

This component is self-contained (reads from offlineStore). The stories\r
below mock store state with simulated conflicts.`}}}},q=[H(`c1`,`BUY_STOCK`,`RELIANCE`,10,2850,`Version conflict: server data is newer`,2),H(`c2`,`SELL_STOCK`,`TCS`,5,3950,`409 Conflict — stale version`,5),H(`c3`,`ADD_TO_WATCHLIST`,`HDFCBANK`,0,0,`Watchlist already exists on server`,8),H(`c4`,`MODIFY_ORDER`,`INFY`,20,1850,`Order already modified since last sync`,15)],J=[H(`c1`,`BUY_STOCK`,`RELIANCE`,10,2850,`Version conflict: server data is newer`,2)],Y={name:`Multiple Conflicts`,render:function(){return U(q),(0,G.jsx)(F,{})}},X={name:`Single Conflict`,render:function(){return U(J),(0,G.jsx)(F,{})}},Z={name:`Trigger Demo (Open Modal)`,render:function(){let[e,t]=(0,W.useState)(!1);return(0,W.useEffect)(()=>(e?O.setState({conflicts:q,pendingCount:q.length}):O.setState({conflicts:[],pendingCount:0}),()=>{O.setState({conflicts:[],pendingCount:0})}),[e]),(0,G.jsxs)(l,{style:{padding:f.lg,gap:f.md},children:[(0,G.jsx)(s,{style:{color:`#E0E6ED`,fontSize:15,fontWeight:`600`},children:`Sync Conflict Modal`}),(0,G.jsx)(s,{style:{color:`#64748B`,fontSize:13},children:`Click the button below to trigger the modal with 4 mock conflicts:`}),(0,G.jsx)(l,{style:{marginTop:f.md,gap:f.sm},children:[`BUY_RELIANCE × 10`,`SELL_TCS × 5`,`WATCHLIST_HDFCBANK`,`MODIFY_INFY × 20`].map((e,t)=>(0,G.jsxs)(l,{style:Q.mockRow,children:[(0,G.jsx)(T,{name:`warning-outline`,size:14,color:`#F97316`}),(0,G.jsx)(s,{style:Q.mockRowText,children:e})]},t))}),(0,G.jsxs)(a,{onPress:()=>t(!0),style:({pressed:e})=>[Q.triggerBtn,e&&{opacity:.7}],children:[(0,G.jsx)(T,{name:`alert-circle-outline`,size:16,color:`#0D0D0D`}),(0,G.jsx)(s,{style:Q.triggerBtnText,children:`Open Modal`})]}),(0,G.jsx)(F,{})]})}},Q=p.create({mockRow:{flexDirection:`row`,alignItems:`center`,gap:8,paddingVertical:4,paddingHorizontal:8,backgroundColor:`rgba(249, 115, 22, 0.06)`,borderRadius:u.xs},mockRowText:{color:`#F97316`,fontSize:12,fontWeight:`500`},triggerBtn:{flexDirection:`row`,alignItems:`center`,justifyContent:`center`,gap:8,backgroundColor:`#F97316`,paddingVertical:f.md,borderRadius:u.md,marginTop:f.sm},triggerBtnText:{color:`#0D0D0D`,fontSize:14,fontWeight:`700`}}),Y.parameters={...Y.parameters,docs:{...Y.parameters?.docs,source:{originalSource:`{
  name: 'Multiple Conflicts',
  render: function Render() {
    useSeedConflicts(MOCK_CONFLICTS);
    return <SyncConflictModal />;
  }
}`,...Y.parameters?.docs?.source}}},X.parameters={...X.parameters,docs:{...X.parameters?.docs,source:{originalSource:`{
  name: 'Single Conflict',
  render: function Render() {
    useSeedConflicts(SINGLE_CONFLICT);
    return <SyncConflictModal />;
  }
}`,...X.parameters?.docs?.source}}},Z.parameters={...Z.parameters,docs:{...Z.parameters?.docs,source:{originalSource:`{
  name: 'Trigger Demo (Open Modal)',
  render: function Render() {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
      if (visible) {
        useOfflineStore.setState({
          conflicts: MOCK_CONFLICTS as any,
          pendingCount: MOCK_CONFLICTS.length
        } as any);
      } else {
        useOfflineStore.setState({
          conflicts: [],
          pendingCount: 0
        } as any);
      }
      return () => {
        useOfflineStore.setState({
          conflicts: [],
          pendingCount: 0
        } as any);
      };
    }, [visible]);
    return <View style={{
      padding: SPACING.lg,
      gap: SPACING.md
    }}>\r
        <Text style={{
        color: '#E0E6ED',
        fontSize: 15,
        fontWeight: '600'
      }}>\r
          Sync Conflict Modal\r
        </Text>\r
        <Text style={{
        color: '#64748B',
        fontSize: 13
      }}>\r
          Click the button below to trigger the modal with 4 mock conflicts:\r
        </Text>\r
        <View style={{
        marginTop: SPACING.md,
        gap: SPACING.sm
      }}>\r
          {['BUY_RELIANCE × 10', 'SELL_TCS × 5', 'WATCHLIST_HDFCBANK', 'MODIFY_INFY × 20'].map((item, i) => <View key={i} style={styles.mockRow}>\r
              <Ionicons name="warning-outline" size={14} color="#F97316" />\r
              <Text style={styles.mockRowText}>{item}</Text>\r
            </View>)}\r
        </View>\r
        <Pressable onPress={() => setVisible(true)} style={({
        pressed
      }) => [styles.triggerBtn, pressed && {
        opacity: 0.7
      }]}>\r
          <Ionicons name="alert-circle-outline" size={16} color="#0D0D0D" />\r
          <Text style={styles.triggerBtnText}>Open Modal</Text>\r
        </Pressable>\r
        <SyncConflictModal />\r
      </View>;
  }
}`,...Z.parameters?.docs?.source}}},$=[`MultipleConflicts`,`SingleConflict`,`TriggerDemo`]}))();export{Y as MultipleConflicts,X as SingleConflict,Z as TriggerDemo,$ as __namedExportsOrder,K as default};