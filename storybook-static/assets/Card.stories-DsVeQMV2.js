import{c as e,i as t}from"./preload-helper-usAeo7Bx.js";import{A as n,C as r,E as i,S as a,Z as o,a as s,at as c,b as l,i as u,mt as d,n as f,o as p,pt as m,r as h,s as g,t as _,v,x as y,y as b}from"./iframe-DPkEPn9P.js";import{n as x,t as S}from"./expo-vector-icons-i__6-MiG.js";import{n as C,t as w}from"./expo-linear-gradient-D-UA3GB3.js";import{n as T,t as E}from"./Button-BiK7chlK.js";function D({children:e,title:t,subtitle:n,rightAction:s,gradient:d,style:p,noPadding:h=!1,animated:g=!1,animationDelay:_=0}){let{colors:b}=f(),x=(0,O.useMemo)(()=>A(b),[b]),S=a(0),C=y(()=>({opacity:l(S.value,[0,1],[0,1]),transform:[{translateY:l(S.value,[0,1],[20,0])}]}));return(0,O.useEffect)(()=>{g&&(S.value=r(_,i(1,{stiffness:120,damping:12})))},[g,_,S]),(0,k.jsxs)(v.View,{style:[x.container,d&&x.gradientContainer,g?C:{},p],children:[d&&(0,k.jsx)(c,{style:m.absoluteFill,children:(0,k.jsx)(w,{colors:d,start:{x:0,y:0},end:{x:1,y:1},style:[m.absoluteFill,{borderRadius:u.lg}]})}),(t||n||s)&&(0,k.jsxs)(c,{style:x.header,children:[(0,k.jsxs)(c,{style:x.headerLeft,children:[t&&(0,k.jsx)(o,{style:x.title,children:t}),n&&(0,k.jsx)(o,{style:x.subtitle,children:n})]}),s&&(0,k.jsx)(c,{children:s})]}),(0,k.jsx)(c,{style:[!h&&x.content],children:e})]})}var O,k,A,j=t((()=>{O=e(d()),n(),b(),C(),_(),g(),k=h(),A=e=>m.create({container:{backgroundColor:e.bgCard,borderRadius:u.lg,borderWidth:1,borderColor:e.border,overflow:`hidden`,boxShadow:`0px 1px 2px rgba(0,0,0,0.3)`},gradientContainer:{borderWidth:1,borderColor:e.border},header:{flexDirection:`row`,justifyContent:`space-between`,alignItems:`center`,paddingHorizontal:p.lg,paddingTop:p.lg,paddingBottom:p.md},headerLeft:{flex:1},title:{...s.semiBold,fontSize:s.size.lg,color:e.text},subtitle:{...s.regular,fontSize:s.size.sm,color:e.textSecondary,marginTop:2},content:{padding:p.lg,paddingTop:0}}),D.__docgenInfo={description:``,methods:[],displayName:`Card`,props:{children:{required:!0,tsType:{name:`ReactReactNode`,raw:`React.ReactNode`},description:``},title:{required:!1,tsType:{name:`string`},description:``},subtitle:{required:!1,tsType:{name:`string`},description:``},rightAction:{required:!1,tsType:{name:`ReactReactNode`,raw:`React.ReactNode`},description:``},gradient:{required:!1,tsType:{name:`unknown`},description:``},style:{required:!1,tsType:{name:`ViewStyle`},description:``},noPadding:{required:!1,tsType:{name:`boolean`},description:``,defaultValue:{value:`false`,computed:!1}},animated:{required:!1,tsType:{name:`boolean`},description:`Enable entry animation (fade-in + slide-up)`,defaultValue:{value:`false`,computed:!1}},animationDelay:{required:!1,tsType:{name:`number`},description:`Delay before entry animation starts (ms)`,defaultValue:{value:`0`,computed:!1}}}}})),M,N,P,F,I,L,R,z,B,V;t((()=>{d(),n(),j(),x(),T(),M=h(),N={title:`UI/Card`,component:D,tags:[`autodocs`],argTypes:{title:{control:`text`},subtitle:{control:`text`},noPadding:{control:`boolean`},animated:{control:`boolean`},animationDelay:{control:`number`}},parameters:{docs:{description:{component:`Card — a versatile content container.\r

Supports titles, subtitles, gradient backgrounds, entry animations,\r
right actions, and configurable padding.`}}}},P={args:{children:(0,M.jsx)(o,{style:{color:`#E0E6ED`,fontSize:14},children:`This is a basic card with default styling. It has a subtle border, rounded corners, and a semi-transparent background.`})}},F={args:{title:`Portfolio Overview`,subtitle:`Your investments at a glance`,children:(0,M.jsxs)(c,{style:{gap:8,marginTop:8},children:[(0,M.jsxs)(c,{style:{flexDirection:`row`,justifyContent:`space-between`},children:[(0,M.jsx)(o,{style:{color:`#64748B`,fontSize:13},children:`Total Invested`}),(0,M.jsx)(o,{style:{color:`#E0E6ED`,fontSize:14,fontWeight:`600`},children:`₹12,45,000`})]}),(0,M.jsxs)(c,{style:{flexDirection:`row`,justifyContent:`space-between`},children:[(0,M.jsx)(o,{style:{color:`#64748B`,fontSize:13},children:`Current Value`}),(0,M.jsx)(o,{style:{color:`#00E676`,fontSize:14,fontWeight:`600`},children:`₹14,82,300`})]}),(0,M.jsxs)(c,{style:{flexDirection:`row`,justifyContent:`space-between`},children:[(0,M.jsx)(o,{style:{color:`#64748B`,fontSize:13},children:`Total Returns`}),(0,M.jsx)(o,{style:{color:`#00E676`,fontSize:14,fontWeight:`600`},children:`+₹2,37,300 (+19.1%)`})]})]})}},I={args:{title:`Quick Actions`,subtitle:`Tap to navigate`,rightAction:(0,M.jsx)(S,{name:`chevron-forward`,size:20,color:`#64748B`}),children:(0,M.jsx)(o,{style:{color:`#E0E6ED`,fontSize:14},children:`Cards can include a right-aligned action element like a chevron, button, or badge for navigation hints.`})}},L={args:{title:`Premium Feature`,subtitle:`Unlock advanced analytics`,gradient:[`rgba(59,130,246,0.15)`,`rgba(99,102,241,0.08)`],children:(0,M.jsx)(c,{style:{marginTop:8},children:(0,M.jsx)(E,{title:`Upgrade to Pro`,variant:`primary`,size:`small`,onPress:()=>{}})})}},R={args:{title:`Welcome Back!`,subtitle:`Your daily market summary`,animated:!0,animationDelay:200,children:(0,M.jsx)(o,{style:{color:`#E0E6ED`,fontSize:14},children:`This card fades in and slides up when mounted. Useful for staggered list animations on screen transitions.`})}},z={args:{title:`Full-bleed Content`,noPadding:!0,children:(0,M.jsx)(c,{style:{height:120,backgroundColor:`rgba(59,130,246,0.1)`,justifyContent:`center`,alignItems:`center`},children:(0,M.jsx)(o,{style:{color:`#60A5FA`,fontSize:14},children:`Full-bleed area`})})}},B={name:`All Variants`,render:()=>(0,M.jsxs)(c,{style:{gap:16},children:[(0,M.jsx)(D,{title:`Basic Card`,subtitle:`Default styling`,children:(0,M.jsx)(o,{style:{color:`#E0E6ED`,fontSize:14},children:`Standard card with header and content area.`})}),(0,M.jsx)(D,{title:`Gradient Card`,subtitle:`Subtle brand gradient`,gradient:[`rgba(0,230,118,0.12)`,`rgba(0,200,83,0.06)`],children:(0,M.jsx)(o,{style:{color:`#E0E6ED`,fontSize:14},children:`Gradient cards draw attention to important features or stats.`})}),(0,M.jsx)(D,{title:`Animated Card`,animated:!0,animationDelay:100,children:(0,M.jsx)(o,{style:{color:`#E0E6ED`,fontSize:14},children:`Entry animation with configurable delay for staggered reveals.`})})]})},P.parameters={...P.parameters,docs:{...P.parameters?.docs,source:{originalSource:`{
  args: {
    children: <Text style={{
      color: '#E0E6ED',
      fontSize: 14
    }}>\r
        This is a basic card with default styling. It has a subtle border,\r
        rounded corners, and a semi-transparent background.\r
      </Text>
  }
}`,...P.parameters?.docs?.source}}},F.parameters={...F.parameters,docs:{...F.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Portfolio Overview',
    subtitle: 'Your investments at a glance',
    children: <View style={{
      gap: 8,
      marginTop: 8
    }}>\r
        <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between'
      }}>\r
          <Text style={{
          color: '#64748B',
          fontSize: 13
        }}>Total Invested</Text>\r
          <Text style={{
          color: '#E0E6ED',
          fontSize: 14,
          fontWeight: '600'
        }}>₹12,45,000</Text>\r
        </View>\r
        <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between'
      }}>\r
          <Text style={{
          color: '#64748B',
          fontSize: 13
        }}>Current Value</Text>\r
          <Text style={{
          color: '#00E676',
          fontSize: 14,
          fontWeight: '600'
        }}>₹14,82,300</Text>\r
        </View>\r
        <View style={{
        flexDirection: 'row',
        justifyContent: 'space-between'
      }}>\r
          <Text style={{
          color: '#64748B',
          fontSize: 13
        }}>Total Returns</Text>\r
          <Text style={{
          color: '#00E676',
          fontSize: 14,
          fontWeight: '600'
        }}>+₹2,37,300 (+19.1%)</Text>\r
        </View>\r
      </View>
  }
}`,...F.parameters?.docs?.source}}},I.parameters={...I.parameters,docs:{...I.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Quick Actions',
    subtitle: 'Tap to navigate',
    rightAction: <Ionicons name="chevron-forward" size={20} color="#64748B" />,
    children: <Text style={{
      color: '#E0E6ED',
      fontSize: 14
    }}>\r
        Cards can include a right-aligned action element like a chevron,\r
        button, or badge for navigation hints.\r
      </Text>
  }
}`,...I.parameters?.docs?.source}}},L.parameters={...L.parameters,docs:{...L.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Premium Feature',
    subtitle: 'Unlock advanced analytics',
    gradient: ['rgba(59,130,246,0.15)', 'rgba(99,102,241,0.08)'] as const,
    children: <View style={{
      marginTop: 8
    }}>\r
        <Button title="Upgrade to Pro" variant="primary" size="small" onPress={() => {}} />\r
      </View>
  }
}`,...L.parameters?.docs?.source}}},R.parameters={...R.parameters,docs:{...R.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Welcome Back!',
    subtitle: 'Your daily market summary',
    animated: true,
    animationDelay: 200,
    children: <Text style={{
      color: '#E0E6ED',
      fontSize: 14
    }}>\r
        This card fades in and slides up when mounted. Useful for staggered\r
        list animations on screen transitions.\r
      </Text>
  }
}`,...R.parameters?.docs?.source}}},z.parameters={...z.parameters,docs:{...z.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Full-bleed Content',
    noPadding: true,
    children: <View style={{
      height: 120,
      backgroundColor: 'rgba(59,130,246,0.1)',
      justifyContent: 'center',
      alignItems: 'center'
    }}>\r
        <Text style={{
        color: '#60A5FA',
        fontSize: 14
      }}>Full-bleed area</Text>\r
      </View>
  }
}`,...z.parameters?.docs?.source}}},B.parameters={...B.parameters,docs:{...B.parameters?.docs,source:{originalSource:`{
  name: 'All Variants',
  render: () => <View style={{
    gap: 16
  }}>\r
      <Card title="Basic Card" subtitle="Default styling">\r
        <Text style={{
        color: '#E0E6ED',
        fontSize: 14
      }}>\r
          Standard card with header and content area.\r
        </Text>\r
      </Card>\r
      <Card title="Gradient Card" subtitle="Subtle brand gradient" gradient={['rgba(0,230,118,0.12)', 'rgba(0,200,83,0.06)'] as const}>\r
        <Text style={{
        color: '#E0E6ED',
        fontSize: 14
      }}>\r
          Gradient cards draw attention to important features or stats.\r
        </Text>\r
      </Card>\r
      <Card title="Animated Card" animated animationDelay={100}>\r
        <Text style={{
        color: '#E0E6ED',
        fontSize: 14
      }}>\r
          Entry animation with configurable delay for staggered reveals.\r
        </Text>\r
      </Card>\r
    </View>
}`,...B.parameters?.docs?.source}}},V=[`Basic`,`WithHeader`,`WithRightAction`,`Gradient`,`AnimatedEntry`,`NoPadding`,`AllVariants`]}))();export{B as AllVariants,R as AnimatedEntry,P as Basic,L as Gradient,z as NoPadding,F as WithHeader,I as WithRightAction,V as __namedExportsOrder,N as default};