import{c as e,i as t}from"./preload-helper-usAeo7Bx.js";import{A as n,C as r,E as i,S as a,Z as o,a as s,at as c,i as l,mt as u,o as d,pt as f,r as p,s as m,v as h,x as g,y as _}from"./iframe-DPkEPn9P.js";function v({label:e,variant:t=`primary`,size:n=`small`,animated:s=!1,animationDelay:l=0}){let u=x[t],d=a(+!s),f=g(()=>({transform:[{scale:d.value}]}));return(0,y.useEffect)(()=>{s&&(d.value=r(l,i(1,{stiffness:120,damping:14})))},[s,l,d]),(0,b.jsxs)(h.View,{style:[S.badge,{backgroundColor:u.bg},n===`medium`&&S.badgeMedium,f],children:[(0,b.jsx)(c,{style:[S.dot,{backgroundColor:u.text}]}),(0,b.jsx)(o,{style:[S.label,{color:u.text},n===`medium`&&S.labelMedium],children:e})]})}var y,b,x,S,C=t((()=>{y=e(u()),n(),_(),m(),b=p(),x={primary:{bg:`#6C63FF20`,text:`#6C63FF`},success:{bg:`#00C85320`,text:`#00C853`},danger:{bg:`#FF174420`,text:`#FF1744`},warning:{bg:`#FFC10720`,text:`#FFC107`},info:{bg:`#00D2FF20`,text:`#00D2FF`},neutral:{bg:`#6E6E9A20`,text:`#6E6E9A`}},S=f.create({badge:{flexDirection:`row`,alignItems:`center`,alignSelf:`flex-start`,paddingHorizontal:d.sm,paddingVertical:3,borderRadius:l.full,gap:4},badgeMedium:{paddingHorizontal:d.md,paddingVertical:6},dot:{width:5,height:5,borderRadius:2.5},label:{fontSize:s.size.xs,fontWeight:`600`,fontFamily:`System`},labelMedium:{fontSize:s.size.sm}}),v.__docgenInfo={description:``,methods:[],displayName:`Badge`,props:{label:{required:!0,tsType:{name:`string`},description:``},variant:{required:!1,tsType:{name:`union`,raw:`'primary' | 'success' | 'danger' | 'warning' | 'info' | 'neutral'`,elements:[{name:`literal`,value:`'primary'`},{name:`literal`,value:`'success'`},{name:`literal`,value:`'danger'`},{name:`literal`,value:`'warning'`},{name:`literal`,value:`'info'`},{name:`literal`,value:`'neutral'`}]},description:``,defaultValue:{value:`'primary'`,computed:!1}},size:{required:!1,tsType:{name:`union`,raw:`'small' | 'medium'`,elements:[{name:`literal`,value:`'small'`},{name:`literal`,value:`'medium'`}]},description:``,defaultValue:{value:`'small'`,computed:!1}},animated:{required:!1,tsType:{name:`boolean`},description:`Enable pop-in entrance animation`,defaultValue:{value:`false`,computed:!1}},animationDelay:{required:!1,tsType:{name:`number`},description:`Delay before animation starts (ms)`,defaultValue:{value:`0`,computed:!1}}}}})),w,T,E,D,O,k,A,j,M,N,P,F,I,L,R,z,B;t((()=>{u(),n(),C(),w=p(),T={title:`UI/Badge`,component:v,tags:[`autodocs`],argTypes:{label:{control:`text`,description:`Badge text label`},variant:{control:`select`,options:[`primary`,`success`,`danger`,`warning`,`info`,`neutral`],description:`Color theme variant`},size:{control:`select`,options:[`small`,`medium`],description:`Badge size (padding + font)`},animated:{control:`boolean`,description:`Enable pop-in entrance animation`},animationDelay:{control:`number`,description:`Delay before animation starts (ms)`}},parameters:{docs:{description:{component:`Badge — a compact status indicator with a colored dot and label.\r

Supports 6 color variants, 2 sizes, and an optional pop-in animation.\r
Commonly used for tags, status labels, and category chips.`}}}},E={args:{label:`Primary`,variant:`primary`}},D={args:{label:`Active`,variant:`success`}},O={args:{label:`Expired`,variant:`danger`}},k={args:{label:`Pending`,variant:`warning`}},A={args:{label:`Updated`,variant:`info`}},j={args:{label:`Draft`,variant:`neutral`}},M={args:{label:`Small`,variant:`primary`,size:`small`}},N={args:{label:`Medium Badge`,variant:`primary`,size:`medium`}},P={args:{label:`New!`,variant:`success`,animated:!0,animationDelay:300}},F={name:`All Variants`,render:()=>(0,w.jsxs)(c,{style:{flexDirection:`row`,flexWrap:`wrap`,gap:8},children:[(0,w.jsx)(v,{label:`Primary`,variant:`primary`}),(0,w.jsx)(v,{label:`Active`,variant:`success`}),(0,w.jsx)(v,{label:`Expired`,variant:`danger`}),(0,w.jsx)(v,{label:`Pending`,variant:`warning`}),(0,w.jsx)(v,{label:`Updated`,variant:`info`}),(0,w.jsx)(v,{label:`Draft`,variant:`neutral`})]})},I={name:`All Sizes`,render:()=>(0,w.jsxs)(c,{style:{gap:12},children:[(0,w.jsxs)(c,{style:{flexDirection:`row`,alignItems:`center`,gap:12},children:[(0,w.jsx)(v,{label:`Small`,variant:`primary`,size:`small`}),(0,w.jsx)(o,{style:{color:`#64748B`,fontSize:12},children:`Small`})]}),(0,w.jsxs)(c,{style:{flexDirection:`row`,alignItems:`center`,gap:12},children:[(0,w.jsx)(v,{label:`Medium`,variant:`primary`,size:`medium`}),(0,w.jsx)(o,{style:{color:`#64748B`,fontSize:12},children:`Medium`})]})]})},L={name:`Animated Entry (Grid)`,render:()=>(0,w.jsxs)(c,{style:{flexDirection:`row`,flexWrap:`wrap`,gap:8},children:[(0,w.jsx)(v,{label:`New`,variant:`success`,animated:!0,animationDelay:0}),(0,w.jsx)(v,{label:`Hot`,variant:`danger`,animated:!0,animationDelay:150}),(0,w.jsx)(v,{label:`Trending`,variant:`warning`,animated:!0,animationDelay:300}),(0,w.jsx)(v,{label:`Updated`,variant:`info`,animated:!0,animationDelay:450})]})},R={name:`Status Labels`,render:()=>(0,w.jsxs)(c,{style:{gap:10},children:[(0,w.jsxs)(c,{style:{flexDirection:`row`,alignItems:`center`,gap:12},children:[(0,w.jsx)(v,{label:`Active`,variant:`success`,size:`medium`}),(0,w.jsx)(o,{style:{color:`#E0E6ED`,fontSize:14},children:`Subscription is active`})]}),(0,w.jsxs)(c,{style:{flexDirection:`row`,alignItems:`center`,gap:12},children:[(0,w.jsx)(v,{label:`Pending`,variant:`warning`,size:`medium`}),(0,w.jsx)(o,{style:{color:`#E0E6ED`,fontSize:14},children:`Awaiting approval`})]}),(0,w.jsxs)(c,{style:{flexDirection:`row`,alignItems:`center`,gap:12},children:[(0,w.jsx)(v,{label:`Expired`,variant:`danger`,size:`medium`}),(0,w.jsx)(o,{style:{color:`#E0E6ED`,fontSize:14},children:`Plan has expired`})]}),(0,w.jsxs)(c,{style:{flexDirection:`row`,alignItems:`center`,gap:12},children:[(0,w.jsx)(v,{label:`Draft`,variant:`neutral`,size:`medium`}),(0,w.jsx)(o,{style:{color:`#E0E6ED`,fontSize:14},children:`Not yet published`})]})]})},z={name:`Portfolio Row`,render:()=>(0,w.jsx)(c,{style:{gap:12,padding:8},children:[{stock:`RELIANCE`,badge:`+2.3%`,variant:`success`},{stock:`TCS`,badge:`-0.8%`,variant:`danger`},{stock:`HDFC`,badge:`+1.1%`,variant:`success`},{stock:`INFY`,badge:`NEW`,variant:`info`}].map((e,t)=>(0,w.jsxs)(c,{style:{flexDirection:`row`,alignItems:`center`,justifyContent:`space-between`,paddingVertical:8,paddingHorizontal:12,backgroundColor:`rgba(255,255,255,0.04)`,borderRadius:8},children:[(0,w.jsx)(o,{style:{color:`#E0E6ED`,fontSize:15,fontWeight:`600`},children:e.stock}),(0,w.jsx)(v,{label:e.badge,variant:e.variant})]},t))})},E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Primary',
    variant: 'primary'
  }
}`,...E.parameters?.docs?.source}}},D.parameters={...D.parameters,docs:{...D.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Active',
    variant: 'success'
  }
}`,...D.parameters?.docs?.source}}},O.parameters={...O.parameters,docs:{...O.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Expired',
    variant: 'danger'
  }
}`,...O.parameters?.docs?.source}}},k.parameters={...k.parameters,docs:{...k.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Pending',
    variant: 'warning'
  }
}`,...k.parameters?.docs?.source}}},A.parameters={...A.parameters,docs:{...A.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Updated',
    variant: 'info'
  }
}`,...A.parameters?.docs?.source}}},j.parameters={...j.parameters,docs:{...j.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Draft',
    variant: 'neutral'
  }
}`,...j.parameters?.docs?.source}}},M.parameters={...M.parameters,docs:{...M.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Small',
    variant: 'primary',
    size: 'small'
  }
}`,...M.parameters?.docs?.source}}},N.parameters={...N.parameters,docs:{...N.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Medium Badge',
    variant: 'primary',
    size: 'medium'
  }
}`,...N.parameters?.docs?.source}}},P.parameters={...P.parameters,docs:{...P.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'New!',
    variant: 'success',
    animated: true,
    animationDelay: 300
  }
}`,...P.parameters?.docs?.source}}},F.parameters={...F.parameters,docs:{...F.parameters?.docs,source:{originalSource:`{
  name: 'All Variants',
  render: () => <View style={{
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  }}>\r
      <Badge label="Primary" variant="primary" />\r
      <Badge label="Active" variant="success" />\r
      <Badge label="Expired" variant="danger" />\r
      <Badge label="Pending" variant="warning" />\r
      <Badge label="Updated" variant="info" />\r
      <Badge label="Draft" variant="neutral" />\r
    </View>
}`,...F.parameters?.docs?.source}}},I.parameters={...I.parameters,docs:{...I.parameters?.docs,source:{originalSource:`{
  name: 'All Sizes',
  render: () => <View style={{
    gap: 12
  }}>\r
      <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12
    }}>\r
        <Badge label="Small" variant="primary" size="small" />\r
        <Text style={{
        color: '#64748B',
        fontSize: 12
      }}>Small</Text>\r
      </View>\r
      <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12
    }}>\r
        <Badge label="Medium" variant="primary" size="medium" />\r
        <Text style={{
        color: '#64748B',
        fontSize: 12
      }}>Medium</Text>\r
      </View>\r
    </View>
}`,...I.parameters?.docs?.source}}},L.parameters={...L.parameters,docs:{...L.parameters?.docs,source:{originalSource:`{
  name: 'Animated Entry (Grid)',
  render: () => <View style={{
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  }}>\r
      <Badge label="New" variant="success" animated animationDelay={0} />\r
      <Badge label="Hot" variant="danger" animated animationDelay={150} />\r
      <Badge label="Trending" variant="warning" animated animationDelay={300} />\r
      <Badge label="Updated" variant="info" animated animationDelay={450} />\r
    </View>
}`,...L.parameters?.docs?.source}}},R.parameters={...R.parameters,docs:{...R.parameters?.docs,source:{originalSource:`{
  name: 'Status Labels',
  render: () => <View style={{
    gap: 10
  }}>\r
      <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12
    }}>\r
        <Badge label="Active" variant="success" size="medium" />\r
        <Text style={{
        color: '#E0E6ED',
        fontSize: 14
      }}>Subscription is active</Text>\r
      </View>\r
      <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12
    }}>\r
        <Badge label="Pending" variant="warning" size="medium" />\r
        <Text style={{
        color: '#E0E6ED',
        fontSize: 14
      }}>Awaiting approval</Text>\r
      </View>\r
      <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12
    }}>\r
        <Badge label="Expired" variant="danger" size="medium" />\r
        <Text style={{
        color: '#E0E6ED',
        fontSize: 14
      }}>Plan has expired</Text>\r
      </View>\r
      <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12
    }}>\r
        <Badge label="Draft" variant="neutral" size="medium" />\r
        <Text style={{
        color: '#E0E6ED',
        fontSize: 14
      }}>Not yet published</Text>\r
      </View>\r
    </View>
}`,...R.parameters?.docs?.source}}},z.parameters={...z.parameters,docs:{...z.parameters?.docs,source:{originalSource:`{
  name: 'Portfolio Row',
  render: () => <View style={{
    gap: 12,
    padding: 8
  }}>\r
      {[{
      stock: 'RELIANCE',
      badge: '+2.3%',
      variant: 'success' as const
    }, {
      stock: 'TCS',
      badge: '-0.8%',
      variant: 'danger' as const
    }, {
      stock: 'HDFC',
      badge: '+1.1%',
      variant: 'success' as const
    }, {
      stock: 'INFY',
      badge: 'NEW',
      variant: 'info' as const
    }].map((item, idx) => <View key={idx} style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: 'rgba(255,255,255,0.04)',
      borderRadius: 8
    }}>\r
          <Text style={{
        color: '#E0E6ED',
        fontSize: 15,
        fontWeight: '600'
      }}>\r
            {item.stock}\r
          </Text>\r
          <Badge label={item.badge} variant={item.variant} />\r
        </View>)}\r
    </View>
}`,...z.parameters?.docs?.source}}},B=[`Primary`,`Success`,`Danger`,`Warning`,`Info`,`Neutral`,`Small`,`Medium`,`AnimatedEntry`,`AllVariants`,`AllSizes`,`AnimatedGrid`,`UseCaseStatusLabels`,`UseCaseRow`]}))();export{I as AllSizes,F as AllVariants,P as AnimatedEntry,L as AnimatedGrid,O as Danger,A as Info,N as Medium,j as Neutral,E as Primary,M as Small,D as Success,z as UseCaseRow,R as UseCaseStatusLabels,k as Warning,B as __namedExportsOrder,T as default};