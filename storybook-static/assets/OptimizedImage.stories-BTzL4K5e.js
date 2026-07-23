import{c as e,i as t}from"./preload-helper-usAeo7Bx.js";import{$ as n,A as r,L as i,U as a,Y as o,Z as s,at as c,d as l,f as u,g as d,h as f,i as p,m,mt as h,n as g,o as _,p as v,pt as y,r as b,s as x,t as S,u as C}from"./iframe-DPkEPn9P.js";import{n as w,t as T}from"./expo-vector-icons-i__6-MiG.js";var E,D=t((()=>{f(),v(),C(),E=d()(m((e,t)=>({fontScale:`medium`,reduceMotion:!1,highContrast:!1,setFontScale:t=>e({fontScale:t}),toggleReduceMotion:()=>e(e=>({reduceMotion:!e.reduceMotion})),setReduceMotion:t=>e({reduceMotion:t}),toggleHighContrast:()=>e(e=>({highContrast:!e.highContrast})),setHighContrast:t=>e({highContrast:t})}),{name:`toroloom-accessibility`,storage:u(()=>l),partialize:e=>({fontScale:e.fontScale,reduceMotion:e.reduceMotion,highContrast:e.highContrast})}))}));function O(e,t={}){let n={...j,...t.config};if(!n.cdnEnabled||!e||e.startsWith(`data:`))return e;let r=new URLSearchParams;t.width&&r.set(`w`,String(t.width)),t.height&&r.set(`h`,String(t.height)),(t.quality??n.quality)&&r.set(`q`,String(t.quality??n.quality)),t.fit&&r.set(`fit`,t.fit),t.format&&t.format!==`original`?r.set(`fm`,t.format):n.format!==`original`&&r.set(`fm`,n.format);let i=r.toString();return i?`${e}${e.includes(`?`)?`&`:`?`}${i}`:e}function k(e,t=`medium`,n){let r=A[t];return O(e,{...r,format:n,fit:`cover`})}var A,j,M=t((()=>{r(),A={thumbnail:{width:64,height:64,quality:60},small:{width:200,height:150,quality:70},medium:{width:400,height:300,quality:80},large:{width:800,height:600,quality:85},hero:{width:1200,height:800,quality:90}},j={format:`webp`,quality:80,lazyLoading:!0,cdnEnabled:!0,cdnBaseUrl:null,cacheTtlSeconds:168*3600,maxCacheSizeMB:100}}));function N({source:e,preset:t=`medium`,width:r,height:l,format:u,style:d,imageStyle:f,borderRadius:m=p.md,showPlaceholder:h=!0,lazy:_=!0,aspectRatio:v,alt:y,resizeMode:b=`cover`,onLoad:x,onError:S}){let{colors:C}=g(),{reduceMotion:w}=E(),[D,O]=(0,P.useState)(!1),[j,M]=(0,P.useState)(!1),[N,L]=(0,P.useState)(!_),R=(0,P.useRef)(new o.Value(0)).current,z=(0,P.useMemo)(()=>e?k(e,t,u):``,[e,t,u]),B=(0,P.useMemo)(()=>{if(r&&l)return{width:r,height:l};if(r&&v)return{width:r,height:r/v};let e=A[t];return{width:r||e.width,height:l||e.height}},[r,l,v,t]);(0,P.useEffect)(()=>{if(!_)return;let e=setTimeout(()=>L(!0),100);return()=>clearTimeout(e)},[_]);let V=(0,P.useCallback)(()=>{if(w){O(!0);return}o.timing(R,{toValue:1,duration:300,useNativeDriver:!0}).start(()=>O(!0))},[R,w]),H=(0,P.useCallback)(()=>{V(),a.configureNext(a.Presets.easeInEaseOut),x?.()},[V,x]),U=(0,P.useCallback)(e=>{M(!0),O(!0),S?.(e)},[S]),W=(0,P.useCallback)(()=>{M(!1),O(!1),R.setValue(0)},[R]),G=(0,P.useMemo)(()=>{let e=d?Array.isArray(d)?Object.assign({},...d):d:{};return{width:e.width||B.width,height:e.height||B.height}},[d,B]);return!N&&_?(0,F.jsx)(c,{style:[I.placeholder,{width:G.width,height:G.height,borderRadius:m,backgroundColor:C.bgCardLight},d]}):j?(0,F.jsxs)(i,{onPress:W,activeOpacity:.7,style:[I.errorContainer,{width:G.width,height:G.height,borderRadius:m,backgroundColor:C.bgCard},d],children:[(0,F.jsx)(T,{name:`image-outline`,size:28,color:C.textMuted}),(0,F.jsx)(s,{style:[I.errorText,{color:C.textMuted}],children:`Tap to retry`})]}):(0,F.jsxs)(c,{style:[{width:G.width,height:G.height,borderRadius:m,overflow:`hidden`,backgroundColor:C.bgCardLight},d],children:[h&&!D&&(0,F.jsx)(c,{style:[I.placeholder,{width:`100%`,height:`100%`,backgroundColor:C.bgCardLight},f]}),(0,F.jsx)(o.View,{style:[I.imageWrapper,{opacity:D?1:R.interpolate({inputRange:[0,1],outputRange:[.3,1]})}],children:(0,F.jsx)(n,{source:{uri:z,cache:`force-cache`},style:[{width:`100%`,height:`100%`,borderRadius:m},f],resizeMode:b,onLoad:H,onError:U,accessibilityLabel:y||`Image`,accessible:!0})})]})}var P,F,I,L=t((()=>{P=e(h()),r(),w(),S(),D(),M(),x(),F=b(),I=y.create({placeholder:{justifyContent:`center`,alignItems:`center`},imageWrapper:{...y.absoluteFill},errorContainer:{justifyContent:`center`,alignItems:`center`,gap:6,borderWidth:1,borderColor:`rgba(128,128,128,0.2)`,borderStyle:`dashed`},errorText:{fontSize:10,fontWeight:`500`}}),N.__docgenInfo={description:``,methods:[],displayName:`OptimizedImage`,props:{source:{required:!0,tsType:{name:`string`},description:`Image URL`},preset:{required:!1,tsType:{name:`union`,raw:`keyof typeof IMAGE_SIZES`,elements:[{name:`literal`,value:`thumbnail`},{name:`literal`,value:`small`},{name:`literal`,value:`medium`},{name:`literal`,value:`large`},{name:`literal`,value:`hero`}]},description:`Size preset for CDN optimization`,defaultValue:{value:`'medium'`,computed:!1}},width:{required:!1,tsType:{name:`number`},description:`Custom width/height (overrides preset)`},height:{required:!1,tsType:{name:`number`},description:``},format:{required:!1,tsType:{name:`union`,raw:`'webp' | 'jpeg' | 'png' | 'original'`,elements:[{name:`literal`,value:`'webp'`},{name:`literal`,value:`'jpeg'`},{name:`literal`,value:`'png'`},{name:`literal`,value:`'original'`}]},description:`Image format override`},style:{required:!1,tsType:{name:`any`},description:`Container style`},imageStyle:{required:!1,tsType:{name:`any`},description:`Image style override`},borderRadius:{required:!1,tsType:{name:`number`},description:`Border radius`,defaultValue:{value:`12`,computed:!1}},showPlaceholder:{required:!1,tsType:{name:`boolean`},description:`Whether to show placeholder shimmer while loading`,defaultValue:{value:`true`,computed:!1}},lazy:{required:!1,tsType:{name:`boolean`},description:`Whether to enable lazy loading (only load when near viewport)`,defaultValue:{value:`true`,computed:!1}},aspectRatio:{required:!1,tsType:{name:`number`},description:`Aspect ratio (e.g. 16/9). If set, height is computed from width`},alt:{required:!1,tsType:{name:`string`},description:`Accessibility label`},resizeMode:{required:!1,tsType:{name:`union`,raw:`'cover' | 'contain' | 'stretch' | 'repeat' | 'center'`,elements:[{name:`literal`,value:`'cover'`},{name:`literal`,value:`'contain'`},{name:`literal`,value:`'stretch'`},{name:`literal`,value:`'repeat'`},{name:`literal`,value:`'center'`}]},description:`Resize mode`,defaultValue:{value:`'cover'`,computed:!1}},onLoad:{required:!1,tsType:{name:`signature`,type:`function`,raw:`() => void`,signature:{arguments:[],return:{name:`void`}}},description:`Called when image loads`},onError:{required:!1,tsType:{name:`signature`,type:`function`,raw:`(error: any) => void`,signature:{arguments:[{type:{name:`any`},name:`error`}],return:{name:`void`}}},description:`Called when image fails`}}}})),R,z,B,V,H,U,W,G,K,q,J,Y,X,Z,Q,$;t((()=>{h(),r(),L(),x(),R=b(),z={title:`UI/OptimizedImage`,component:N,tags:[`autodocs`],argTypes:{preset:{control:`select`,options:[`thumbnail`,`small`,`medium`,`large`,`hero`],description:`Size preset for CDN optimization`},resizeMode:{control:`select`,options:[`cover`,`contain`,`stretch`,`center`],description:`Image resize mode`},showPlaceholder:{control:`boolean`},lazy:{control:`boolean`},aspectRatio:{control:`number`},borderRadius:{control:`number`}},parameters:{docs:{description:{component:`OptimizedImage — a drop-in replacement for React Native Image with\r
CDN-optimized URLs (WebP, resize, quality), fade-in animation,\r
placeholder shimmer, lazy loading, and error state with retry.\r

Supports preset sizes, custom dimensions, and aspect ratio mode.`}}}},B=`https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80`,V=`https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80`,H={args:{source:B,preset:`medium`,style:{width:300,height:200},alt:`Stock market chart`}},U=[{key:`thumbnail`,width:60,height:60},{key:`small`,width:120,height:90},{key:`medium`,width:200,height:150},{key:`large`,width:280,height:200}],W={name:`Size Presets`,render:()=>(0,R.jsx)(c,{style:{gap:_.md},children:U.map(({key:e,width:t,height:n})=>(0,R.jsxs)(c,{style:{flexDirection:`row`,alignItems:`center`,gap:_.md},children:[(0,R.jsx)(N,{source:B,preset:e,style:{width:t,height:n},alt:`${e} preset`}),(0,R.jsxs)(c,{children:[(0,R.jsx)(s,{style:{color:`#E0E6ED`,fontSize:13,fontWeight:`600`,textTransform:`capitalize`},children:e}),(0,R.jsxs)(s,{style:{color:`#64748B`,fontSize:11},children:[t,` × `,n]})]})]},e))})},G={args:{source:B,width:300,aspectRatio:16/9,alt:`16:9 aspect ratio image`}},K={name:`Round (Avatar)`,args:{source:`https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80`,preset:`thumbnail`,style:{width:64,height:64},borderRadius:32,alt:`User avatar`,resizeMode:`cover`}},q={args:{source:V,preset:`medium`,style:{width:280,height:180},borderRadius:24,alt:`Rounded image`}},J={args:{source:B,preset:`medium`,style:{width:200,height:200},resizeMode:`contain`,alt:`Image in contain mode`}},Y={args:{source:B,preset:`large`,style:{width:300,height:200},lazy:!0,alt:`Lazy loaded image`}},X={args:{source:V,preset:`medium`,style:{width:280,height:180},showPlaceholder:!1,alt:`Image without placeholder shimmer`}},Z={name:`Error State (broken URL)`,args:{source:`https://invalid-url.example.com/image.jpg`,preset:`medium`,style:{width:280,height:180},alt:`Broken image shows error state`}},Q={name:`All States`,render:()=>(0,R.jsxs)(c,{style:{gap:_.md},children:[(0,R.jsx)(N,{source:B,preset:`medium`,style:{width:`100%`,height:140},alt:`Loaded image example`}),(0,R.jsx)(N,{source:`https://invalid-url.example.com/image.jpg`,preset:`medium`,style:{width:`100%`,height:80},alt:`Error state example`}),(0,R.jsx)(N,{source:V,preset:`small`,style:{width:`100%`,height:80},lazy:!0,alt:`Lazy loaded example`})]})},H.parameters={...H.parameters,docs:{...H.parameters?.docs,source:{originalSource:`{
  args: {
    source: SAMPLE_IMAGE,
    preset: 'medium',
    style: {
      width: 300,
      height: 200
    },
    alt: 'Stock market chart'
  }
}`,...H.parameters?.docs?.source}}},W.parameters={...W.parameters,docs:{...W.parameters?.docs,source:{originalSource:`{
  name: 'Size Presets',
  render: () => <View style={{
    gap: SPACING.md
  }}>\r
      {presetSizes.map(({
      key,
      width,
      height
    }) => <View key={key} style={{
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md
    }}>\r
          <OptimizedImage source={SAMPLE_IMAGE} preset={key as any} style={{
        width,
        height
      }} alt={\`\${key} preset\`} />\r
          <View>\r
            <Text style={{
          color: '#E0E6ED',
          fontSize: 13,
          fontWeight: '600',
          textTransform: 'capitalize'
        }}>\r
              {key}\r
            </Text>\r
            <Text style={{
          color: '#64748B',
          fontSize: 11
        }}>\r
              {width} × {height}\r
            </Text>\r
          </View>\r
        </View>)}\r
    </View>
}`,...W.parameters?.docs?.source}}},G.parameters={...G.parameters,docs:{...G.parameters?.docs,source:{originalSource:`{
  args: {
    source: SAMPLE_IMAGE,
    width: 300,
    aspectRatio: 16 / 9,
    alt: '16:9 aspect ratio image'
  }
}`,...G.parameters?.docs?.source}}},K.parameters={...K.parameters,docs:{...K.parameters?.docs,source:{originalSource:`{
  name: 'Round (Avatar)',
  args: {
    source: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80',
    preset: 'thumbnail',
    style: {
      width: 64,
      height: 64
    },
    borderRadius: 32,
    alt: 'User avatar',
    resizeMode: 'cover'
  }
}`,...K.parameters?.docs?.source}}},q.parameters={...q.parameters,docs:{...q.parameters?.docs,source:{originalSource:`{
  args: {
    source: SAMPLE_IMAGE_2,
    preset: 'medium',
    style: {
      width: 280,
      height: 180
    },
    borderRadius: 24,
    alt: 'Rounded image'
  }
}`,...q.parameters?.docs?.source}}},J.parameters={...J.parameters,docs:{...J.parameters?.docs,source:{originalSource:`{
  args: {
    source: SAMPLE_IMAGE,
    preset: 'medium',
    style: {
      width: 200,
      height: 200
    },
    resizeMode: 'contain',
    alt: 'Image in contain mode'
  }
}`,...J.parameters?.docs?.source}}},Y.parameters={...Y.parameters,docs:{...Y.parameters?.docs,source:{originalSource:`{
  args: {
    source: SAMPLE_IMAGE,
    preset: 'large',
    style: {
      width: 300,
      height: 200
    },
    lazy: true,
    alt: 'Lazy loaded image'
  }
}`,...Y.parameters?.docs?.source}}},X.parameters={...X.parameters,docs:{...X.parameters?.docs,source:{originalSource:`{
  args: {
    source: SAMPLE_IMAGE_2,
    preset: 'medium',
    style: {
      width: 280,
      height: 180
    },
    showPlaceholder: false,
    alt: 'Image without placeholder shimmer'
  }
}`,...X.parameters?.docs?.source}}},Z.parameters={...Z.parameters,docs:{...Z.parameters?.docs,source:{originalSource:`{
  name: 'Error State (broken URL)',
  args: {
    source: 'https://invalid-url.example.com/image.jpg',
    preset: 'medium',
    style: {
      width: 280,
      height: 180
    },
    alt: 'Broken image shows error state'
  }
}`,...Z.parameters?.docs?.source}}},Q.parameters={...Q.parameters,docs:{...Q.parameters?.docs,source:{originalSource:`{
  name: 'All States',
  render: () => <View style={{
    gap: SPACING.md
  }}>\r
      <OptimizedImage source={SAMPLE_IMAGE} preset="medium" style={{
      width: '100%',
      height: 140
    }} alt="Loaded image example" />\r
      <OptimizedImage source="https://invalid-url.example.com/image.jpg" preset="medium" style={{
      width: '100%',
      height: 80
    }} alt="Error state example" />\r
      <OptimizedImage source={SAMPLE_IMAGE_2} preset="small" style={{
      width: '100%',
      height: 80
    }} lazy alt="Lazy loaded example" />\r
    </View>
}`,...Q.parameters?.docs?.source}}},$=[`Default`,`Presets`,`WithAspectRatio`,`RoundAvatar`,`CustomBorderRadius`,`ContainMode`,`LazyLoading`,`NoPlaceholder`,`ErrorState`,`AllStates`]}))();export{Q as AllStates,J as ContainMode,q as CustomBorderRadius,H as Default,Z as ErrorState,Y as LazyLoading,X as NoPlaceholder,W as Presets,K as RoundAvatar,G as WithAspectRatio,$ as __namedExportsOrder,z as default};