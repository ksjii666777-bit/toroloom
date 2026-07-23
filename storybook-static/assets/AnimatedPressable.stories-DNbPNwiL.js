import{i as e}from"./preload-helper-usAeo7Bx.js";import{A as t,Z as n,at as r,i,mt as a,o,pt as s,r as c,s as l}from"./iframe-DPkEPn9P.js";import{n as u,t as d}from"./AnimatedPressable-D_mIu1OS.js";import{n as f,t as p}from"./expo-vector-icons-i__6-MiG.js";function m({title:e,subtitle:t=`Tap to interact`}){return(0,h.jsxs)(r,{style:_.card,children:[(0,h.jsx)(r,{style:_.icon,children:(0,h.jsx)(p,{name:`hand-left-outline`,size:20,color:`#60A5FA`})}),(0,h.jsxs)(r,{style:{flex:1},children:[(0,h.jsx)(n,{style:_.cardText,children:e}),(0,h.jsx)(n,{style:_.cardSubtext,children:t})]}),(0,h.jsx)(p,{name:`chevron-forward`,size:18,color:`#64748B`})]})}var h,g,_,v,y,b,x,S,C,w,T,E,D,O;e((()=>{a(),t(),u(),f(),l(),h=c(),g={title:`UI/AnimatedPressable`,component:d,tags:[`autodocs`],argTypes:{scaleTo:{control:{type:`range`,min:.8,max:1,step:.01},description:`Scale on press-in (lower = more squash)`},haptic:{control:`select`,options:[`light`,`medium`,`heavy`,`selection`,`none`],description:`Haptic feedback type on press`},disabled:{control:`boolean`},highlight:{control:`boolean`,description:`Show colored overlay on press`},highlightColor:{control:`color`,description:`Overlay color (defaults to theme primary)`},borderRadius:{control:`number`}},parameters:{docs:{description:{component:`AnimatedPressable — a drop-in pressable wrapper with spring-based scale\r
animation, configurable haptic feedback, and an optional highlight overlay.\r

Wraps any child content and adds touch feedback automatically. Used as the\r
base interaction primitive across the entire app (buttons, cards, list rows).`}}}},_=s.create({card:{backgroundColor:`rgba(255,255,255,0.06)`,borderRadius:i.md,borderWidth:1,borderColor:`rgba(255,255,255,0.08)`,padding:o.lg,flexDirection:`row`,alignItems:`center`,gap:o.md},cardText:{color:`#E0E6ED`,fontSize:15,fontWeight:`600`,flex:1},cardSubtext:{color:`#64748B`,fontSize:12,marginTop:2},icon:{width:40,height:40,borderRadius:20,backgroundColor:`rgba(59,130,246,0.15)`,justifyContent:`center`,alignItems:`center`}}),v={args:{onPress:()=>alert(`Pressed!`),haptic:`light`},render:e=>(0,h.jsx)(d,{...e,children:(0,h.jsx)(m,{title:`Default Pressable`,subtitle:`Light haptic · 0.96 scale`})})},y={args:{onPress:()=>alert(`Pressed!`),highlight:!0,haptic:`medium`},render:e=>(0,h.jsx)(d,{...e,children:(0,h.jsx)(m,{title:`With Highlight`,subtitle:`Blue overlay on press · medium haptic`})})},b={args:{onPress:()=>alert(`Pressed!`),highlight:!0,highlightColor:`#22C55E`,haptic:`medium`},render:e=>(0,h.jsx)(d,{...e,children:(0,h.jsx)(m,{title:`Custom Highlight`,subtitle:`Green overlay instead of default blue`})})},x={args:{onPress:()=>alert(`Squished!`),scaleTo:.85,haptic:`heavy`},render:e=>(0,h.jsx)(d,{...e,children:(0,h.jsx)(m,{title:`Aggressive Scale (0.85)`,subtitle:`Heavy haptic · more squash`})})},S={args:{onPress:()=>alert(`Pressed!`),scaleTo:.98,haptic:`selection`},render:e=>(0,h.jsx)(d,{...e,children:(0,h.jsx)(m,{title:`Subtle Scale (0.98)`,subtitle:`Selection haptic · barely noticeable`})})},C={args:{disabled:!0},render:e=>(0,h.jsx)(d,{...e,children:(0,h.jsx)(m,{title:`Disabled`,subtitle:`No press feedback · not tappable`})})},w={args:{onPress:()=>alert(`Pressed!`),haptic:`none`},render:e=>(0,h.jsx)(d,{...e,children:(0,h.jsx)(m,{title:`No Haptic`,subtitle:`Visual scale only · no vibration`})})},T={args:{onPress:()=>alert(`Pressed!`),borderRadius:20},render:e=>(0,h.jsx)(d,{...e,children:(0,h.jsxs)(r,{style:[_.card,{borderRadius:20,backgroundColor:`rgba(249,115,22,0.1)`,borderColor:`rgba(249,115,22,0.2)`}],children:[(0,h.jsx)(r,{style:[_.icon,{backgroundColor:`rgba(249,115,22,0.15)`}],children:(0,h.jsx)(p,{name:`sparkles-outline`,size:20,color:`#F97316`})}),(0,h.jsxs)(r,{style:{flex:1},children:[(0,h.jsx)(n,{style:_.cardText,children:`Custom Radius (20)`}),(0,h.jsx)(n,{style:_.cardSubtext,children:`Fully rounded · pill shape`})]}),(0,h.jsx)(p,{name:`chevron-forward`,size:18,color:`#64748B`})]})})},E={name:`All States`,render:()=>(0,h.jsxs)(r,{style:{gap:o.md},children:[(0,h.jsx)(d,{onPress:()=>alert(`Default`),children:(0,h.jsx)(m,{title:`Default`,subtitle:`Normal press behavior`})}),(0,h.jsx)(d,{onPress:()=>alert(`Highlight`),highlight:!0,children:(0,h.jsx)(m,{title:`Highlight`,subtitle:`With press overlay`})}),(0,h.jsx)(d,{onPress:()=>alert(`Aggressive`),scaleTo:.85,haptic:`heavy`,children:(0,h.jsx)(m,{title:`Aggressive Scale`,subtitle:`0.85 · heavy haptic`})}),(0,h.jsx)(d,{disabled:!0,children:(0,h.jsx)(m,{title:`Disabled`,subtitle:`Not interactive`})}),(0,h.jsx)(d,{onPress:()=>alert(`Subtle`),scaleTo:.98,haptic:`selection`,children:(0,h.jsx)(m,{title:`Subtle`,subtitle:`0.98 · selection haptic`})})]})},D={name:`Use Case — Menu Row`,render:()=>(0,h.jsx)(r,{style:{gap:o.xs},children:[{icon:`wallet-outline`,title:`Portfolio`,subtitle:`View holdings & P&L`,color:`#22C55E`},{icon:`trending-up-outline`,title:`Markets`,subtitle:`Nifty, Bank Nifty, stocks`,color:`#60A5FA`},{icon:`git-network-outline`,title:`F&O Chain`,subtitle:`Options & futures`,color:`#A78BFA`},{icon:`bulb-outline`,title:`AI Insights`,subtitle:`AI-powered market analysis`,color:`#F97316`}].map((e,t)=>(0,h.jsx)(d,{onPress:()=>alert(`Navigating to ${e.title}`),haptic:t===0?`medium`:`light`,highlight:!0,highlightColor:e.color,children:(0,h.jsxs)(r,{style:[_.card],children:[(0,h.jsx)(r,{style:[_.icon,{backgroundColor:`${e.color}22`}],children:(0,h.jsx)(p,{name:e.icon,size:20,color:e.color})}),(0,h.jsxs)(r,{style:{flex:1},children:[(0,h.jsx)(n,{style:_.cardText,children:e.title}),(0,h.jsx)(n,{style:_.cardSubtext,children:e.subtitle})]}),(0,h.jsx)(p,{name:`chevron-forward`,size:16,color:`#64748B`})]})},t))})},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    onPress: () => alert('Pressed!'),
    haptic: 'light'
  },
  render: args => <AnimatedPressable {...args}>\r
      <DemoCard title="Default Pressable" subtitle="Light haptic · 0.96 scale" />\r
    </AnimatedPressable>
}`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    onPress: () => alert('Pressed!'),
    highlight: true,
    haptic: 'medium'
  },
  render: args => <AnimatedPressable {...args}>\r
      <DemoCard title="With Highlight" subtitle="Blue overlay on press · medium haptic" />\r
    </AnimatedPressable>
}`,...y.parameters?.docs?.source}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    onPress: () => alert('Pressed!'),
    highlight: true,
    highlightColor: '#22C55E',
    haptic: 'medium'
  },
  render: args => <AnimatedPressable {...args}>\r
      <DemoCard title="Custom Highlight" subtitle="Green overlay instead of default blue" />\r
    </AnimatedPressable>
}`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  args: {
    onPress: () => alert('Squished!'),
    scaleTo: 0.85,
    haptic: 'heavy'
  },
  render: args => <AnimatedPressable {...args}>\r
      <DemoCard title="Aggressive Scale (0.85)" subtitle="Heavy haptic · more squash" />\r
    </AnimatedPressable>
}`,...x.parameters?.docs?.source}}},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  args: {
    onPress: () => alert('Pressed!'),
    scaleTo: 0.98,
    haptic: 'selection'
  },
  render: args => <AnimatedPressable {...args}>\r
      <DemoCard title="Subtle Scale (0.98)" subtitle="Selection haptic · barely noticeable" />\r
    </AnimatedPressable>
}`,...S.parameters?.docs?.source}}},C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  args: {
    disabled: true
  },
  render: args => <AnimatedPressable {...args}>\r
      <DemoCard title="Disabled" subtitle="No press feedback · not tappable" />\r
    </AnimatedPressable>
}`,...C.parameters?.docs?.source}}},w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    onPress: () => alert('Pressed!'),
    haptic: 'none'
  },
  render: args => <AnimatedPressable {...args}>\r
      <DemoCard title="No Haptic" subtitle="Visual scale only · no vibration" />\r
    </AnimatedPressable>
}`,...w.parameters?.docs?.source}}},T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  args: {
    onPress: () => alert('Pressed!'),
    borderRadius: 20
  },
  render: args => <AnimatedPressable {...args}>\r
      <View style={[cardStyles.card, {
      borderRadius: 20,
      backgroundColor: 'rgba(249,115,22,0.1)',
      borderColor: 'rgba(249,115,22,0.2)'
    }]}>\r
        <View style={[cardStyles.icon, {
        backgroundColor: 'rgba(249,115,22,0.15)'
      }]}>\r
          <Ionicons name="sparkles-outline" size={20} color="#F97316" />\r
        </View>\r
        <View style={{
        flex: 1
      }}>\r
          <Text style={cardStyles.cardText}>Custom Radius (20)</Text>\r
          <Text style={cardStyles.cardSubtext}>Fully rounded · pill shape</Text>\r
        </View>\r
        <Ionicons name="chevron-forward" size={18} color="#64748B" />\r
      </View>\r
    </AnimatedPressable>
}`,...T.parameters?.docs?.source}}},E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  name: 'All States',
  render: () => <View style={{
    gap: SPACING.md
  }}>\r
      <AnimatedPressable onPress={() => alert('Default')}>\r
        <DemoCard title="Default" subtitle="Normal press behavior" />\r
      </AnimatedPressable>\r
      <AnimatedPressable onPress={() => alert('Highlight')} highlight>\r
        <DemoCard title="Highlight" subtitle="With press overlay" />\r
      </AnimatedPressable>\r
      <AnimatedPressable onPress={() => alert('Aggressive')} scaleTo={0.85} haptic="heavy">\r
        <DemoCard title="Aggressive Scale" subtitle="0.85 · heavy haptic" />\r
      </AnimatedPressable>\r
      <AnimatedPressable disabled>\r
        <DemoCard title="Disabled" subtitle="Not interactive" />\r
      </AnimatedPressable>\r
      <AnimatedPressable onPress={() => alert('Subtle')} scaleTo={0.98} haptic="selection">\r
        <DemoCard title="Subtle" subtitle="0.98 · selection haptic" />\r
      </AnimatedPressable>\r
    </View>
}`,...E.parameters?.docs?.source}}},D.parameters={...D.parameters,docs:{...D.parameters?.docs,source:{originalSource:`{
  name: 'Use Case — Menu Row',
  render: () => <View style={{
    gap: SPACING.xs
  }}>\r
      {[{
      icon: 'wallet-outline',
      title: 'Portfolio',
      subtitle: 'View holdings & P&L',
      color: '#22C55E'
    }, {
      icon: 'trending-up-outline',
      title: 'Markets',
      subtitle: 'Nifty, Bank Nifty, stocks',
      color: '#60A5FA'
    }, {
      icon: 'git-network-outline',
      title: 'F&O Chain',
      subtitle: 'Options & futures',
      color: '#A78BFA'
    }, {
      icon: 'bulb-outline',
      title: 'AI Insights',
      subtitle: 'AI-powered market analysis',
      color: '#F97316'
    }].map((item, i) => <AnimatedPressable key={i} onPress={() => alert(\`Navigating to \${item.title}\`)} haptic={i === 0 ? 'medium' : 'light'} highlight highlightColor={item.color}>\r
          <View style={[cardStyles.card]}>\r
            <View style={[cardStyles.icon, {
          backgroundColor: \`\${item.color}22\` as string
        }]}>\r
              <Ionicons name={item.icon as any} size={20} color={item.color} />\r
            </View>\r
            <View style={{
          flex: 1
        }}>\r
              <Text style={cardStyles.cardText}>{item.title}</Text>\r
              <Text style={cardStyles.cardSubtext}>{item.subtitle}</Text>\r
            </View>\r
            <Ionicons name="chevron-forward" size={16} color="#64748B" />\r
          </View>\r
        </AnimatedPressable>)}\r
    </View>
}`,...D.parameters?.docs?.source}}},O=[`Default`,`WithHighlight`,`CustomHighlight`,`AggressiveScale`,`SubtleScale`,`Disabled`,`NoHaptic`,`CustomBorderRadius`,`AllStates`,`UseCaseCardRow`]}))();export{x as AggressiveScale,E as AllStates,T as CustomBorderRadius,b as CustomHighlight,v as Default,C as Disabled,w as NoHaptic,S as SubtleScale,D as UseCaseCardRow,y as WithHighlight,O as __namedExportsOrder,g as default};