import{c as e,i as t}from"./preload-helper-usAeo7Bx.js";import{A as n,D as r,S as i,T as a,Z as o,at as s,i as c,mt as l,n as u,o as d,pt as f,r as p,s as m,t as h,tt as g,v as _,w as v,x as y,y as b}from"./iframe-DPkEPn9P.js";function x({width:e=`100%`,height:t=20,borderRadius:n=c.sm,style:o,variant:s=`rect`}){let{colors:l}=u(),d=i(.3),f=y(()=>({opacity:d.value}));(0,T.useEffect)(()=>(d.value=v(a(r(.7,{duration:800}),r(.3,{duration:800})),-1,!0),()=>{d.value=.3}),[d]);let p=s===`circle`?999:n;return(0,E.jsx)(_.View,{style:[{width:e,height:t,borderRadius:p,backgroundColor:l.bgCardLight},f,o]})}function S({lines:e=3,hasAvatar:t=!0,hasAction:n=!1,style:r}){return(0,E.jsx)(s,{style:[D.card,r],children:(0,E.jsxs)(s,{style:D.row,children:[t&&(0,E.jsx)(x,{width:40,height:40,borderRadius:c.md}),(0,E.jsxs)(s,{style:D.content,children:[(0,E.jsx)(x,{width:`60%`,height:14}),(0,E.jsx)(s,{style:{height:d.sm}}),(0,E.jsx)(x,{width:`40%`,height:12}),e>2&&(0,E.jsxs)(E.Fragment,{children:[(0,E.jsx)(s,{style:{height:d.xs}}),(0,E.jsx)(x,{width:`80%`,height:10})]})]}),n&&(0,E.jsx)(x,{width:60,height:32,borderRadius:c.full})]})})}function C({count:e=5,cardProps:t,style:n}){return(0,E.jsx)(s,{style:n,children:Array.from({length:e}).map((e,n)=>(0,E.jsx)(S,{...t},`skeleton_${n}`))})}function w(){let{colors:e}=u();return(0,E.jsxs)(s,{style:[D.portfolioCard,{backgroundColor:e.bgCard,borderColor:e.border}],children:[(0,E.jsx)(x,{width:80,height:12}),(0,E.jsx)(s,{style:{height:d.sm}}),(0,E.jsx)(x,{width:`50%`,height:32}),(0,E.jsx)(s,{style:{height:d.md}}),(0,E.jsx)(s,{style:D.statsRow,children:[1,2,3].map(e=>(0,E.jsxs)(s,{style:D.statItem,children:[(0,E.jsx)(x,{width:60,height:24}),(0,E.jsx)(s,{style:{height:4}}),(0,E.jsx)(x,{width:40,height:10})]},`stat_${e}`))})]})}var T,E,D,O=t((()=>{T=e(l()),n(),b(),h(),m(),E=p(),D=f.create({card:{padding:d.lg,borderRadius:c.md,marginBottom:d.sm},row:{flexDirection:`row`,alignItems:`center`},content:{flex:1,marginLeft:d.md},portfolioCard:{padding:d.xl,borderRadius:c.xl,borderWidth:1,marginBottom:d.lg},statsRow:{flexDirection:`row`,gap:d.xl},statItem:{alignItems:`center`}}),x.__docgenInfo={description:``,methods:[],displayName:`SkeletonBlock`,props:{width:{required:!1,tsType:{name:`union`,raw:`number | string`,elements:[{name:`number`},{name:`string`}]},description:``,defaultValue:{value:`'100%'`,computed:!1}},height:{required:!1,tsType:{name:`number`},description:``,defaultValue:{value:`20`,computed:!1}},borderRadius:{required:!1,tsType:{name:`number`},description:``,defaultValue:{value:`8`,computed:!1}},style:{required:!1,tsType:{name:`ViewStyle`},description:``},variant:{required:!1,tsType:{name:`union`,raw:`'rect' | 'circle' | 'text'`,elements:[{name:`literal`,value:`'rect'`},{name:`literal`,value:`'circle'`},{name:`literal`,value:`'text'`}]},description:``,defaultValue:{value:`'rect'`,computed:!1}}}},S.__docgenInfo={description:``,methods:[],displayName:`SkeletonCard`,props:{lines:{required:!1,tsType:{name:`number`},description:``,defaultValue:{value:`3`,computed:!1}},hasAvatar:{required:!1,tsType:{name:`boolean`},description:``,defaultValue:{value:`true`,computed:!1}},hasAction:{required:!1,tsType:{name:`boolean`},description:``,defaultValue:{value:`false`,computed:!1}},style:{required:!1,tsType:{name:`ViewStyle`},description:``}}},C.__docgenInfo={description:``,methods:[],displayName:`SkeletonList`,props:{count:{required:!1,tsType:{name:`number`},description:``,defaultValue:{value:`5`,computed:!1}},cardProps:{required:!1,tsType:{name:`Partial`,elements:[{name:`SkeletonCardProps`}],raw:`Partial<SkeletonCardProps>`},description:``},style:{required:!1,tsType:{name:`ViewStyle`},description:``}}},w.__docgenInfo={description:``,methods:[],displayName:`PortfolioSkeleton`}})),k,A,j,M,N,P,F,I,L,R,z,B,V,H,U,W,G;t((()=>{l(),n(),O(),m(),k=p(),A={title:`UI/SkeletonLoader`,component:x,tags:[`autodocs`],argTypes:{width:{control:`text`,description:`Block width (number or % string)`},height:{control:`number`,description:`Block height in px`},borderRadius:{control:`number`,description:`Border radius in px`},variant:{control:`select`,options:[`rect`,`circle`,`text`],description:`Shape variant (circle forces full roundness)`}},parameters:{docs:{description:{component:"SkeletonLoader — loading placeholder components for shimmer effects.\r\n\nFour sub-components:\r\n- `SkeletonBlock` — a single shimmering block (rect, circle, or text variant)\r\n- `SkeletonCard` — a card with optional avatar, action, and configurable lines\r\n- `SkeletonList` — a repeated list of SkeletonCard items\r\n- `PortfolioSkeleton` — a full portfolio summary placeholder"}}}},j={args:{width:200,height:120,variant:`rect`,borderRadius:12}},M={args:{width:60,height:60,variant:`circle`}},N={args:{width:`60%`,height:14,variant:`text`,borderRadius:4}},P={args:{width:`85%`,height:14,variant:`text`,borderRadius:4}},F={name:`Card — Simple (2 lines, no avatar)`,render:()=>(0,k.jsx)(S,{lines:2,hasAvatar:!1,hasAction:!1})},I={name:`Card — With Avatar`,render:()=>(0,k.jsx)(S,{lines:2,hasAvatar:!0,hasAction:!1})},L={name:`Card — With Action Button`,render:()=>(0,k.jsx)(S,{lines:2,hasAvatar:!0,hasAction:!0})},R={name:`Card — Full (3 lines + Avatar + Action)`,render:()=>(0,k.jsx)(S,{lines:3,hasAvatar:!0,hasAction:!0})},z={name:`Card — 5 Lines + Avatar`,render:()=>(0,k.jsx)(S,{lines:5,hasAvatar:!0,hasAction:!1})},B={name:`List — Default (5 items)`,render:()=>(0,k.jsx)(C,{count:5})},V={name:`List — Compact (3 items, no avatars)`,render:()=>(0,k.jsx)(C,{count:3,cardProps:{hasAvatar:!1,lines:2}})},H={name:`List — Detailed (2 items, full)`,render:()=>(0,k.jsx)(C,{count:2,cardProps:{hasAvatar:!0,hasAction:!0,lines:4}})},U={name:`Portfolio — Summary Card`,render:()=>(0,k.jsx)(w,{})},W={name:`All Variants`,render:()=>(0,k.jsx)(g,{style:{flex:1},children:(0,k.jsxs)(s,{style:{gap:d.lg,paddingBottom:40},children:[(0,k.jsxs)(s,{children:[(0,k.jsx)(o,{style:{color:`#64748B`,fontSize:11,fontWeight:`700`,textTransform:`uppercase`,letterSpacing:.5,marginBottom:8},children:`Skeleton Blocks`}),(0,k.jsxs)(s,{style:{flexDirection:`row`,gap:12,alignItems:`center`},children:[(0,k.jsx)(x,{width:60,height:60,variant:`circle`}),(0,k.jsx)(x,{width:120,height:80,variant:`rect`,borderRadius:12}),(0,k.jsx)(x,{width:`30%`,height:14,variant:`text`,borderRadius:4})]})]}),(0,k.jsxs)(s,{children:[(0,k.jsx)(o,{style:{color:`#64748B`,fontSize:11,fontWeight:`700`,textTransform:`uppercase`,letterSpacing:.5,marginBottom:8},children:`Skeleton Cards`}),(0,k.jsx)(S,{lines:3,hasAvatar:!0,hasAction:!0}),(0,k.jsx)(s,{style:{height:d.sm}}),(0,k.jsx)(S,{lines:2,hasAvatar:!1,hasAction:!1})]}),(0,k.jsxs)(s,{children:[(0,k.jsx)(o,{style:{color:`#64748B`,fontSize:11,fontWeight:`700`,textTransform:`uppercase`,letterSpacing:.5,marginBottom:8},children:`Skeleton List`}),(0,k.jsx)(C,{count:3})]}),(0,k.jsxs)(s,{children:[(0,k.jsx)(o,{style:{color:`#64748B`,fontSize:11,fontWeight:`700`,textTransform:`uppercase`,letterSpacing:.5,marginBottom:8},children:`Portfolio Skeleton`}),(0,k.jsx)(w,{})]})]})})},j.parameters={...j.parameters,docs:{...j.parameters?.docs,source:{originalSource:`{
  args: {
    width: 200,
    height: 120,
    variant: 'rect',
    borderRadius: 12
  }
}`,...j.parameters?.docs?.source}}},M.parameters={...M.parameters,docs:{...M.parameters?.docs,source:{originalSource:`{
  args: {
    width: 60,
    height: 60,
    variant: 'circle'
  }
}`,...M.parameters?.docs?.source}}},N.parameters={...N.parameters,docs:{...N.parameters?.docs,source:{originalSource:`{
  args: {
    width: '60%',
    height: 14,
    variant: 'text',
    borderRadius: 4
  }
}`,...N.parameters?.docs?.source}}},P.parameters={...P.parameters,docs:{...P.parameters?.docs,source:{originalSource:`{
  args: {
    width: '85%',
    height: 14,
    variant: 'text',
    borderRadius: 4
  }
}`,...P.parameters?.docs?.source}}},F.parameters={...F.parameters,docs:{...F.parameters?.docs,source:{originalSource:`{
  name: 'Card — Simple (2 lines, no avatar)',
  render: () => <SkeletonCard lines={2} hasAvatar={false} hasAction={false} />
}`,...F.parameters?.docs?.source}}},I.parameters={...I.parameters,docs:{...I.parameters?.docs,source:{originalSource:`{
  name: 'Card — With Avatar',
  render: () => <SkeletonCard lines={2} hasAvatar hasAction={false} />
}`,...I.parameters?.docs?.source}}},L.parameters={...L.parameters,docs:{...L.parameters?.docs,source:{originalSource:`{
  name: 'Card — With Action Button',
  render: () => <SkeletonCard lines={2} hasAvatar hasAction />
}`,...L.parameters?.docs?.source}}},R.parameters={...R.parameters,docs:{...R.parameters?.docs,source:{originalSource:`{
  name: 'Card — Full (3 lines + Avatar + Action)',
  render: () => <SkeletonCard lines={3} hasAvatar hasAction />
}`,...R.parameters?.docs?.source}}},z.parameters={...z.parameters,docs:{...z.parameters?.docs,source:{originalSource:`{
  name: 'Card — 5 Lines + Avatar',
  render: () => <SkeletonCard lines={5} hasAvatar hasAction={false} />
}`,...z.parameters?.docs?.source}}},B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  name: 'List — Default (5 items)',
  render: () => <SkeletonList count={5} />
}`,...B.parameters?.docs?.source}}},V.parameters={...V.parameters,docs:{...V.parameters?.docs,source:{originalSource:`{
  name: 'List — Compact (3 items, no avatars)',
  render: () => <SkeletonList count={3} cardProps={{
    hasAvatar: false,
    lines: 2
  }} />
}`,...V.parameters?.docs?.source}}},H.parameters={...H.parameters,docs:{...H.parameters?.docs,source:{originalSource:`{
  name: 'List — Detailed (2 items, full)',
  render: () => <SkeletonList count={2} cardProps={{
    hasAvatar: true,
    hasAction: true,
    lines: 4
  }} />
}`,...H.parameters?.docs?.source}}},U.parameters={...U.parameters,docs:{...U.parameters?.docs,source:{originalSource:`{
  name: 'Portfolio — Summary Card',
  render: () => <PortfolioSkeleton />
}`,...U.parameters?.docs?.source}}},W.parameters={...W.parameters,docs:{...W.parameters?.docs,source:{originalSource:`{
  name: 'All Variants',
  render: () => <ScrollView style={{
    flex: 1
  }}>\r
      <View style={{
      gap: SPACING.lg,
      paddingBottom: 40
    }}>\r
\r
        <View>\r
          <Text style={{
          color: '#64748B',
          fontSize: 11,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 8
        }}>\r
            Skeleton Blocks\r
          </Text>\r
          <View style={{
          flexDirection: 'row',
          gap: 12,
          alignItems: 'center'
        }}>\r
            <SkeletonBlock width={60} height={60} variant="circle" />\r
            <SkeletonBlock width={120} height={80} variant="rect" borderRadius={12} />\r
            <SkeletonBlock width="30%" height={14} variant="text" borderRadius={4} />\r
          </View>\r
        </View>\r
\r
        <View>\r
          <Text style={{
          color: '#64748B',
          fontSize: 11,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 8
        }}>\r
            Skeleton Cards\r
          </Text>\r
          <SkeletonCard lines={3} hasAvatar hasAction />\r
          <View style={{
          height: SPACING.sm
        }} />\r
          <SkeletonCard lines={2} hasAvatar={false} hasAction={false} />\r
        </View>\r
\r
        <View>\r
          <Text style={{
          color: '#64748B',
          fontSize: 11,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 8
        }}>\r
            Skeleton List\r
          </Text>\r
          <SkeletonList count={3} />\r
        </View>\r
\r
        <View>\r
          <Text style={{
          color: '#64748B',
          fontSize: 11,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          marginBottom: 8
        }}>\r
            Portfolio Skeleton\r
          </Text>\r
          <PortfolioSkeleton />\r
        </View>\r
\r
      </View>\r
    </ScrollView>
}`,...W.parameters?.docs?.source}}},G=[`RectBlock`,`CircleBlock`,`TextLine`,`WideTextLine`,`CardSimple`,`CardWithAvatar`,`CardWithAction`,`CardFull`,`CardManyLines`,`ListDefault`,`ListCompact`,`ListDetailed`,`PortfolioSummary`,`AllVariants`]}))();export{W as AllVariants,R as CardFull,z as CardManyLines,F as CardSimple,L as CardWithAction,I as CardWithAvatar,M as CircleBlock,V as ListCompact,B as ListDefault,H as ListDetailed,U as PortfolioSummary,j as RectBlock,N as TextLine,P as WideTextLine,G as __namedExportsOrder,A as default};