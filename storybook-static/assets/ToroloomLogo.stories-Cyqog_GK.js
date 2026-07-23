import{c as e,i as t}from"./preload-helper-usAeo7Bx.js";import{A as n,Z as r,at as i,mt as a,r as o}from"./iframe-DPkEPn9P.js";import{a as s,c,d as l,l as u,n as d,o as f,r as p,t as m,u as h}from"./react-native-svg-ooHxpWXG.js";function g({size:e=48}){let t=e,n=t/2,r=t/2,i=t/48,a=(0,_.useMemo)(()=>e=>{let t=[];for(let a=0;a<6;a++){let o=Math.PI/3*a-Math.PI/2,s=n+e*i*Math.cos(o),c=r+e*i*Math.sin(o);t.push(`${a===0?`M`:`L`}${s.toFixed(1)},${c.toFixed(1)}`)}return t.join(` `)+` Z`},[n,r,i]);return(0,v.jsxs)(h,{width:t,height:t,viewBox:`0 0 ${t} ${t}`,children:[(0,v.jsxs)(d,{children:[(0,v.jsxs)(s,{id:`logoGrad`,x1:`0`,y1:`0`,x2:`1`,y2:`1`,children:[(0,v.jsx)(u,{offset:`0%`,stopColor:`#3B82F6`,stopOpacity:`1`}),(0,v.jsx)(u,{offset:`50%`,stopColor:`#6366F1`,stopOpacity:`0.9`}),(0,v.jsx)(u,{offset:`100%`,stopColor:`#10B981`,stopOpacity:`0.8`})]}),(0,v.jsxs)(s,{id:`glowGrad`,x1:`0.5`,y1:`0`,x2:`0.5`,y2:`1`,children:[(0,v.jsx)(u,{offset:`0%`,stopColor:`#3B82F6`,stopOpacity:`0.25`}),(0,v.jsx)(u,{offset:`100%`,stopColor:`#10B981`,stopOpacity:`0.05`})]}),(0,v.jsxs)(s,{id:`coreGrad`,x1:`0`,y1:`0`,x2:`1`,y2:`1`,children:[(0,v.jsx)(u,{offset:`0%`,stopColor:`#60A5FA`,stopOpacity:`1`}),(0,v.jsx)(u,{offset:`100%`,stopColor:`#34D399`,stopOpacity:`0.9`})]}),(0,v.jsxs)(s,{id:`gridGrad`,x1:`0`,y1:`0`,x2:`1`,y2:`0`,children:[(0,v.jsx)(u,{offset:`0%`,stopColor:`#3B82F6`,stopOpacity:`0`}),(0,v.jsx)(u,{offset:`30%`,stopColor:`#3B82F6`,stopOpacity:`0.4`}),(0,v.jsx)(u,{offset:`70%`,stopColor:`#10B981`,stopOpacity:`0.4`}),(0,v.jsx)(u,{offset:`100%`,stopColor:`#10B981`,stopOpacity:`0`})]})]}),(0,v.jsx)(m,{cx:n,cy:r,r:22*i,fill:`url(#glowGrad)`}),(0,v.jsx)(f,{d:a(20),fill:`none`,stroke:`url(#logoGrad)`,strokeWidth:1.5*i,strokeLinejoin:`round`,opacity:.6}),(0,v.jsx)(f,{d:a(14),fill:`none`,stroke:`url(#logoGrad)`,strokeWidth:1.2*i,strokeLinejoin:`round`,opacity:.8}),(0,v.jsx)(f,{d:a(8),fill:`url(#coreGrad)`,stroke:`url(#logoGrad)`,strokeWidth:1*i,strokeLinejoin:`round`,opacity:.95}),(0,v.jsx)(m,{cx:n,cy:r,r:2*i,fill:`#FFFFFF`,opacity:.9}),(0,v.jsxs)(p,{opacity:.25,children:[(0,v.jsx)(c,{x:n-.3*i,y:r-16*i,width:.6*i,height:32*i,fill:`url(#gridGrad)`,rx:.3*i}),(0,v.jsx)(c,{x:n-9*i,y:r-16*i,width:.4*i,height:32*i,fill:`url(#gridGrad)`,rx:.2*i,opacity:.5}),(0,v.jsx)(c,{x:n+9*i,y:r-16*i,width:.4*i,height:32*i,fill:`url(#gridGrad)`,rx:.2*i,opacity:.5})]}),(0,v.jsxs)(p,{opacity:.2,stroke:`url(#logoGrad)`,strokeWidth:.5*i,children:[(0,v.jsx)(f,{d:`M${n-18*i},${r-10*i} L${n+18*i},${r+10*i}`}),(0,v.jsx)(f,{d:`M${n-18*i},${r+10*i} L${n+18*i},${r-10*i}`})]})]})}var _,v,y=t((()=>{_=e(a()),l(),v=o(),g.__docgenInfo={description:``,methods:[],displayName:`ToroloomLogo`,props:{size:{required:!1,tsType:{name:`number`},description:``,defaultValue:{value:`48`,computed:!1}}}}})),b,x,S,C,w,T,E,D,O,k;t((()=>{a(),n(),y(),b=o(),x={title:`UI/ToroloomLogo`,component:g,tags:[`autodocs`],argTypes:{size:{control:{type:`number`,min:16,max:256,step:8},description:`Logo dimension (width & height in px)`}},parameters:{docs:{description:{component:`ToroloomLogo — the app's brand logo rendered as an SVG.\r

Features concentric hexagons, a center execution dot, matrix grid lines,\r
and gradient fills (Electric Blue → Emerald). Uses react-native-svg.`}}}},S={args:{size:48}},C={args:{size:24}},w={args:{size:64}},T={args:{size:120}},E={args:{size:200}},D={name:`All Sizes`,render:()=>(0,b.jsx)(i,{style:{gap:16},children:[24,32,48,64,96,120].map(e=>(0,b.jsxs)(i,{style:{flexDirection:`row`,alignItems:`center`,gap:12},children:[(0,b.jsx)(g,{size:e}),(0,b.jsxs)(r,{style:{color:`#64748B`,fontSize:12},children:[e,`×`,e,`px`]})]},e))})},O={name:`Inline with Text`,render:()=>(0,b.jsxs)(i,{style:{gap:12},children:[(0,b.jsxs)(i,{style:{flexDirection:`row`,alignItems:`center`,gap:8},children:[(0,b.jsx)(g,{size:28}),(0,b.jsx)(r,{style:{color:`#E0E6ED`,fontSize:20,fontWeight:`700`},children:`Toroloom`})]}),(0,b.jsxs)(i,{style:{flexDirection:`row`,alignItems:`center`,gap:8},children:[(0,b.jsx)(g,{size:20}),(0,b.jsx)(r,{style:{color:`#64748B`,fontSize:13},children:`Powered by Toroloom`})]})]})},S.parameters={...S.parameters,docs:{...S.parameters?.docs,source:{originalSource:`{
  args: {
    size: 48
  }
}`,...S.parameters?.docs?.source}}},C.parameters={...C.parameters,docs:{...C.parameters?.docs,source:{originalSource:`{
  args: {
    size: 24
  }
}`,...C.parameters?.docs?.source}}},w.parameters={...w.parameters,docs:{...w.parameters?.docs,source:{originalSource:`{
  args: {
    size: 64
  }
}`,...w.parameters?.docs?.source}}},T.parameters={...T.parameters,docs:{...T.parameters?.docs,source:{originalSource:`{
  args: {
    size: 120
  }
}`,...T.parameters?.docs?.source}}},E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  args: {
    size: 200
  }
}`,...E.parameters?.docs?.source}}},D.parameters={...D.parameters,docs:{...D.parameters?.docs,source:{originalSource:`{
  name: 'All Sizes',
  render: () => <View style={{
    gap: 16
  }}>\r
      {[24, 32, 48, 64, 96, 120].map(s => <View key={s} style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12
    }}>\r
          <ToroloomLogo size={s} />\r
          <Text style={{
        color: '#64748B',
        fontSize: 12
      }}>{s}×{s}px</Text>\r
        </View>)}\r
    </View>
}`,...D.parameters?.docs?.source}}},O.parameters={...O.parameters,docs:{...O.parameters?.docs,source:{originalSource:`{
  name: 'Inline with Text',
  render: () => <View style={{
    gap: 12
  }}>\r
      <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8
    }}>\r
        <ToroloomLogo size={28} />\r
        <Text style={{
        color: '#E0E6ED',
        fontSize: 20,
        fontWeight: '700'
      }}>Toroloom</Text>\r
      </View>\r
      <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8
    }}>\r
        <ToroloomLogo size={20} />\r
        <Text style={{
        color: '#64748B',
        fontSize: 13
      }}>Powered by Toroloom</Text>\r
      </View>\r
    </View>
}`,...O.parameters?.docs?.source}}},k=[`Default`,`Small`,`Medium`,`Large`,`ExtraLarge`,`SizesShowcase`,`InlineWithText`]}))();export{S as Default,E as ExtraLarge,O as InlineWithText,T as Large,w as Medium,D as SizesShowcase,C as Small,k as __namedExportsOrder,x as default};