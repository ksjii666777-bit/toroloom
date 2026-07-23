import{i as e}from"./preload-helper-usAeo7Bx.js";import{A as t,at as n,mt as r,r as i}from"./iframe-DPkEPn9P.js";import{n as a,t as o}from"./expo-vector-icons-i__6-MiG.js";import{n as s,t as c}from"./Button-BiK7chlK.js";var l,u,d,f,p,m,h,g,_,v,y,b,x,S,C,w,T,E,D;e((()=>{r(),t(),s(),a(),l=i(),u={title:`UI/Button`,component:c,tags:[`autodocs`],argTypes:{variant:{control:`select`,options:[`primary`,`secondary`,`outline`,`ghost`,`danger`,`success`],description:`Visual style variant`},size:{control:`select`,options:[`small`,`medium`,`large`],description:`Button size (padding + font)`},loading:{control:`boolean`},disabled:{control:`boolean`},title:{control:`text`}},parameters:{docs:{description:{component:`Button — the primary call-to-action component.\r

Supports 6 variants, 3 sizes, loading/disabled states, icons, and gradients.\r
All buttons use AnimatedPressable under the hood for scale + haptic feedback.`}}}},d={args:{title:`Primary Action`,variant:`primary`,onPress:()=>alert(`Pressed!`)}},f={args:{title:`Secondary Action`,variant:`secondary`,onPress:()=>alert(`Pressed!`)}},p={args:{title:`Outline Button`,variant:`outline`,onPress:()=>alert(`Pressed!`)}},m={args:{title:`Ghost Button`,variant:`ghost`,onPress:()=>alert(`Pressed!`)}},h={args:{title:`Delete Account`,variant:`danger`,onPress:()=>alert(`Deleted!`)}},g={args:{title:`Complete`,variant:`success`,onPress:()=>alert(`Done!`)}},_={args:{title:`Small`,size:`small`,onPress:()=>{}}},v={args:{title:`Medium`,size:`medium`,onPress:()=>{}}},y={args:{title:`Large Button`,size:`large`,onPress:()=>{}}},b={args:{title:`Saving...`,loading:!0,onPress:()=>{}}},x={args:{title:`Disabled`,disabled:!0,onPress:()=>{}}},S={render:e=>(0,l.jsx)(c,{...e,title:`Download Report`,variant:`primary`,onPress:()=>{},icon:(0,l.jsx)(o,{name:`download-outline`,size:18,color:`#FFF`})})},C={render:e=>(0,l.jsx)(c,{...e,title:`Custom Gradient`,onPress:()=>{},gradient:[`#8B5CF6`,`#6C63FF`]})},w={name:`All Variants`,render:()=>(0,l.jsxs)(n,{style:{gap:12},children:[(0,l.jsx)(c,{title:`Primary`,variant:`primary`,onPress:()=>{}}),(0,l.jsx)(c,{title:`Secondary`,variant:`secondary`,onPress:()=>{}}),(0,l.jsx)(c,{title:`Outline`,variant:`outline`,onPress:()=>{}}),(0,l.jsx)(c,{title:`Ghost`,variant:`ghost`,onPress:()=>{}}),(0,l.jsx)(c,{title:`Danger`,variant:`danger`,onPress:()=>{}}),(0,l.jsx)(c,{title:`Success`,variant:`success`,onPress:()=>{}})]})},T={name:`All Sizes`,render:()=>(0,l.jsxs)(n,{style:{gap:12},children:[(0,l.jsx)(c,{title:`Small`,size:`small`,variant:`primary`,onPress:()=>{}}),(0,l.jsx)(c,{title:`Medium`,size:`medium`,variant:`primary`,onPress:()=>{}}),(0,l.jsx)(c,{title:`Large`,size:`large`,variant:`primary`,onPress:()=>{}})]})},E={name:`All States`,render:()=>(0,l.jsxs)(n,{style:{gap:12},children:[(0,l.jsx)(c,{title:`Normal`,variant:`primary`,onPress:()=>{}}),(0,l.jsx)(c,{title:`Loading...`,loading:!0,variant:`primary`,onPress:()=>{}}),(0,l.jsx)(c,{title:`Disabled`,disabled:!0,variant:`primary`,onPress:()=>{}})]})},d.parameters={...d.parameters,docs:{...d.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Primary Action',
    variant: 'primary',
    onPress: () => alert('Pressed!')
  }
}`,...d.parameters?.docs?.source}}},f.parameters={...f.parameters,docs:{...f.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Secondary Action',
    variant: 'secondary',
    onPress: () => alert('Pressed!')
  }
}`,...f.parameters?.docs?.source}}},p.parameters={...p.parameters,docs:{...p.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Outline Button',
    variant: 'outline',
    onPress: () => alert('Pressed!')
  }
}`,...p.parameters?.docs?.source}}},m.parameters={...m.parameters,docs:{...m.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Ghost Button',
    variant: 'ghost',
    onPress: () => alert('Pressed!')
  }
}`,...m.parameters?.docs?.source}}},h.parameters={...h.parameters,docs:{...h.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Delete Account',
    variant: 'danger',
    onPress: () => alert('Deleted!')
  }
}`,...h.parameters?.docs?.source}}},g.parameters={...g.parameters,docs:{...g.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Complete',
    variant: 'success',
    onPress: () => alert('Done!')
  }
}`,...g.parameters?.docs?.source}}},_.parameters={..._.parameters,docs:{..._.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Small',
    size: 'small',
    onPress: () => {}
  }
}`,..._.parameters?.docs?.source}}},v.parameters={...v.parameters,docs:{...v.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Medium',
    size: 'medium',
    onPress: () => {}
  }
}`,...v.parameters?.docs?.source}}},y.parameters={...y.parameters,docs:{...y.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Large Button',
    size: 'large',
    onPress: () => {}
  }
}`,...y.parameters?.docs?.source}}},b.parameters={...b.parameters,docs:{...b.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Saving...',
    loading: true,
    onPress: () => {}
  }
}`,...b.parameters?.docs?.source}}},x.parameters={...x.parameters,docs:{...x.parameters?.docs,source:{originalSource:`{
  args: {
    title: 'Disabled',
    disabled: true,
    onPress: () => {}
  }
}`,...x.parameters?.docs?.source}}},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  render: (args: any) => <Button {...args} title="Download Report" variant="primary" onPress={() => {}} icon={<Ionicons name="download-outline" size={18} color="#FFF" />} />
}`,...S.parameters?.docs?.source}}},C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  render: (args: any) => <Button {...args} title="Custom Gradient" onPress={() => {}} gradient={['#8B5CF6', '#6C63FF'] as const} />
}`,...C.parameters?.docs?.source}}},w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  name: 'All Variants',
  render: () => <View style={{
    gap: 12
  }}>\r
      <Button title="Primary" variant="primary" onPress={() => {}} />\r
      <Button title="Secondary" variant="secondary" onPress={() => {}} />\r
      <Button title="Outline" variant="outline" onPress={() => {}} />\r
      <Button title="Ghost" variant="ghost" onPress={() => {}} />\r
      <Button title="Danger" variant="danger" onPress={() => {}} />\r
      <Button title="Success" variant="success" onPress={() => {}} />\r
    </View>
}`,...w.parameters?.docs?.source}}},T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  name: 'All Sizes',
  render: () => <View style={{
    gap: 12
  }}>\r
      <Button title="Small" size="small" variant="primary" onPress={() => {}} />\r
      <Button title="Medium" size="medium" variant="primary" onPress={() => {}} />\r
      <Button title="Large" size="large" variant="primary" onPress={() => {}} />\r
    </View>
}`,...T.parameters?.docs?.source}}},E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  name: 'All States',
  render: () => <View style={{
    gap: 12
  }}>\r
      <Button title="Normal" variant="primary" onPress={() => {}} />\r
      <Button title="Loading..." loading variant="primary" onPress={() => {}} />\r
      <Button title="Disabled" disabled variant="primary" onPress={() => {}} />\r
    </View>
}`,...E.parameters?.docs?.source}}},D=[`Primary`,`Secondary`,`Outline`,`Ghost`,`Danger`,`Success`,`Small`,`Medium`,`Large`,`Loading`,`Disabled`,`WithIcon`,`CustomGradient`,`AllVariants`,`AllSizes`,`AllStates`]}))();export{T as AllSizes,E as AllStates,w as AllVariants,C as CustomGradient,h as Danger,x as Disabled,m as Ghost,y as Large,b as Loading,v as Medium,p as Outline,d as Primary,f as Secondary,_ as Small,g as Success,S as WithIcon,D as __namedExportsOrder,u as default};