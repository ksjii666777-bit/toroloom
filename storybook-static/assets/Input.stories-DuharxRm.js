import{c as e,i as t}from"./preload-helper-usAeo7Bx.js";import{A as n,N as r,Z as i,a,at as o,i as s,mt as c,n as l,o as u,pt as d,r as f,s as p,st as m,t as h}from"./iframe-DPkEPn9P.js";import{n as g,t as _}from"./expo-vector-icons-i__6-MiG.js";function v({label:e,placeholder:t,value:n,onChangeText:a,secureTextEntry:s=!1,error:c,icon:u,keyboardType:d=`default`,multiline:f=!1,style:p,autoCapitalize:m=`none`,testID:h,id:g,name:v,onSubmitEditing:S}){let{colors:C}=l(),w=(0,y.useMemo)(()=>x(C),[C]),[T,E]=(0,y.useState)(!1),[D,O]=(0,y.useState)(!1),k=c?C.danger:T?C.primary:C.border,A=(0,y.useCallback)(()=>{E(!0)},[]),j=(0,y.useCallback)(()=>{E(!1)},[]);return(0,b.jsxs)(o,{style:[w.container,p],children:[e&&(0,b.jsx)(i,{style:[w.label,c&&w.labelError],children:e}),(0,b.jsxs)(o,{style:[w.inputContainer,{borderColor:k},f&&w.multilineContainer],children:[u&&(0,b.jsx)(_,{name:u,size:20,color:c?C.danger:T?C.primary:C.textMuted,style:w.icon}),(0,b.jsx)(r,{style:[w.input,f&&w.multiline],placeholder:t,placeholderTextColor:C.textMuted,value:n,onChangeText:a,secureTextEntry:s&&!D,onFocus:A,onBlur:j,keyboardType:d,multiline:f,autoCapitalize:m,testID:h,selectionColor:C.primary,cursorColor:C.primary,onSubmitEditing:S,returnKeyType:S?`go`:`default`,id:g,name:v}),s&&(0,b.jsx)(_,{name:D?`eye-off-outline`:`eye-outline`,size:20,color:C.textMuted,onPress:()=>O(!D),style:w.eyeIcon}),!s&&n.length>0&&!c&&T&&(0,b.jsx)(_,{name:`checkmark-circle`,size:18,color:C.success,style:w.validIcon})]}),c&&(0,b.jsxs)(o,{style:w.errorContainer,children:[(0,b.jsx)(_,{name:`alert-circle`,size:14,color:C.danger}),(0,b.jsx)(i,{style:w.errorText,children:c}),`        `]})]})}var y,b,x,S=t((()=>{y=e(c()),n(),g(),h(),p(),b=f(),x=e=>d.create({container:{marginBottom:u.lg},label:{...a.medium,fontSize:a.size.sm,color:e.textSecondary,marginBottom:u.sm,letterSpacing:.3},labelError:{color:e.danger},inputContainer:{flexDirection:`row`,alignItems:`center`,backgroundColor:e.bgInput,borderRadius:s.md,borderWidth:1.5,borderColor:e.border,paddingHorizontal:u.md},multilineContainer:{minHeight:80,alignItems:`flex-start`},icon:{marginRight:u.sm},input:{flex:1,color:e.text,fontSize:a.size.md,paddingVertical:m.OS===`ios`?u.md:u.sm+2,fontFamily:m.OS===`ios`?`System`:`sans-serif`},multiline:{minHeight:60,textAlignVertical:`top`,paddingTop:u.sm},eyeIcon:{marginLeft:u.sm,padding:4},validIcon:{marginLeft:u.xs},errorContainer:{flexDirection:`row`,alignItems:`center`,gap:u.xs,marginTop:u.xs,paddingLeft:u.xs},errorText:{...a.regular,fontSize:a.size.xs,color:e.danger,flex:1}}),v.__docgenInfo={description:``,methods:[],displayName:`Input`,props:{label:{required:!1,tsType:{name:`string`},description:``},placeholder:{required:!1,tsType:{name:`string`},description:``},value:{required:!0,tsType:{name:`string`},description:``},onChangeText:{required:!0,tsType:{name:`signature`,type:`function`,raw:`(text: string) => void`,signature:{arguments:[{type:{name:`string`},name:`text`}],return:{name:`void`}}},description:``},secureTextEntry:{required:!1,tsType:{name:`boolean`},description:``,defaultValue:{value:`false`,computed:!1}},error:{required:!1,tsType:{name:`string`},description:``},icon:{required:!1,tsType:{name:`unknown`},description:``},keyboardType:{required:!1,tsType:{name:`union`,raw:`'default' | 'numeric' | 'email-address' | 'phone-pad' | 'decimal-pad'`,elements:[{name:`literal`,value:`'default'`},{name:`literal`,value:`'numeric'`},{name:`literal`,value:`'email-address'`},{name:`literal`,value:`'phone-pad'`},{name:`literal`,value:`'decimal-pad'`}]},description:``,defaultValue:{value:`'default'`,computed:!1}},multiline:{required:!1,tsType:{name:`boolean`},description:``,defaultValue:{value:`false`,computed:!1}},style:{required:!1,tsType:{name:`ViewStyle`},description:``},autoCapitalize:{required:!1,tsType:{name:`union`,raw:`'none' | 'sentences' | 'words' | 'characters'`,elements:[{name:`literal`,value:`'none'`},{name:`literal`,value:`'sentences'`},{name:`literal`,value:`'words'`},{name:`literal`,value:`'characters'`}]},description:``,defaultValue:{value:`'none'`,computed:!1}},testID:{required:!1,tsType:{name:`string`},description:``},id:{required:!1,tsType:{name:`string`},description:'HTML `id` attribute — React Native Web passes this to the underlying DOM input.\nFixes browser a11y warning: "A form field element should have an id or name attribute"'},name:{required:!1,tsType:{name:`string`},description:'HTML `name` attribute — React Native Web passes this to the underlying DOM input.\nFixes browser a11y warning: "A form field element should have an id or name attribute"'},onSubmitEditing:{required:!1,tsType:{name:`signature`,type:`function`,raw:`() => void`,signature:{arguments:[],return:{name:`void`}}},description:`Called when the user presses the submit/return key (web & iOS).
Use on the last field of a form to trigger submission on Enter.`}}}})),C,w,T,E,D,O,k,A,j,M,N;t((()=>{C=e(c()),n(),S(),w=f(),T={title:`UI/Input`,component:v,tags:[`autodocs`],argTypes:{label:{control:`text`},placeholder:{control:`text`},error:{control:`text`},secureTextEntry:{control:`boolean`},multiline:{control:`boolean`},keyboardType:{control:`select`,options:[`default`,`numeric`,`email-address`,`phone-pad`]},icon:{control:`select`,options:[`mail-outline`,`lock-closed-outline`,`person-outline`,`search-outline`,`call-outline`]}},parameters:{docs:{description:{component:`Input — a styled text input with label, icon, validation, and password visibility.\r

Supports labels, placeholders, error states, icons, secure text entry,\r
multiline, and keyboard type configuration.`}}}},E={render:()=>{let[e,t]=(0,C.useState)(``);return(0,w.jsx)(v,{label:`Full Name`,placeholder:`Enter your full name`,value:e,onChangeText:t})}},D={args:{label:`Email Address`,placeholder:`Enter your email`,value:`rahul@example.com`,onChangeText:()=>{},keyboardType:`email-address`}},O={args:{label:`Phone Number`,placeholder:`Enter your phone number`,value:`+91 98765 43210`,onChangeText:()=>{},icon:`call-outline`,keyboardType:`phone-pad`}},k={args:{label:`Password`,placeholder:`Enter your password`,value:`abc`,onChangeText:()=>{},error:`Password must be at least 6 characters`,secureTextEntry:!0}},A={args:{label:`Password`,placeholder:`Create a strong password`,value:``,onChangeText:()=>{},secureTextEntry:!0,icon:`lock-closed-outline`}},j={args:{label:`Bio`,placeholder:`Tell us about yourself...`,value:``,onChangeText:()=>{},multiline:!0}},M={name:`All States`,render:()=>(0,w.jsxs)(o,{style:{gap:4},children:[(0,w.jsx)(v,{label:`Default Input`,placeholder:`No value, no focus`,value:``,onChangeText:()=>{}}),(0,w.jsx)(v,{label:`With Value`,placeholder:`Enter text`,value:`Sample text value`,onChangeText:()=>{}}),(0,w.jsx)(v,{label:`Email Input`,placeholder:`email@example.com`,value:`user@toroloom.app`,onChangeText:()=>{},icon:`mail-outline`,keyboardType:`email-address`}),(0,w.jsx)(v,{label:`Password`,placeholder:`Enter password`,value:``,onChangeText:()=>{},secureTextEntry:!0,icon:`lock-closed-outline`}),(0,w.jsx)(v,{label:`With Error`,placeholder:`Enter value`,value:`invalid`,onChangeText:()=>{},error:`Please enter a valid value`}),(0,w.jsx)(v,{label:`Multiline`,placeholder:`Write a longer message...`,value:``,onChangeText:()=>{},multiline:!0})]})},E.parameters={...E.parameters,docs:{...E.parameters?.docs,source:{originalSource:`{
  render: () => {
    const [val, setVal] = useState('');
    return <Input label="Full Name" placeholder="Enter your full name" value={val} onChangeText={setVal} />;
  }
}`,...E.parameters?.docs?.source}}},D.parameters={...D.parameters,docs:{...D.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Email Address',
    placeholder: 'Enter your email',
    value: 'rahul@example.com',
    onChangeText: () => {},
    keyboardType: 'email-address'
  }
}`,...D.parameters?.docs?.source}}},O.parameters={...O.parameters,docs:{...O.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Phone Number',
    placeholder: 'Enter your phone number',
    value: '+91 98765 43210',
    onChangeText: () => {},
    icon: 'call-outline' as const,
    keyboardType: 'phone-pad'
  }
}`,...O.parameters?.docs?.source}}},k.parameters={...k.parameters,docs:{...k.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Password',
    placeholder: 'Enter your password',
    value: 'abc',
    onChangeText: () => {},
    error: 'Password must be at least 6 characters',
    secureTextEntry: true
  }
}`,...k.parameters?.docs?.source}}},A.parameters={...A.parameters,docs:{...A.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Password',
    placeholder: 'Create a strong password',
    value: '',
    onChangeText: () => {},
    secureTextEntry: true,
    icon: 'lock-closed-outline' as const
  }
}`,...A.parameters?.docs?.source}}},j.parameters={...j.parameters,docs:{...j.parameters?.docs,source:{originalSource:`{
  args: {
    label: 'Bio',
    placeholder: 'Tell us about yourself...',
    value: '',
    onChangeText: () => {},
    multiline: true
  }
}`,...j.parameters?.docs?.source}}},M.parameters={...M.parameters,docs:{...M.parameters?.docs,source:{originalSource:`{
  name: 'All States',
  render: () => <View style={{
    gap: 4
  }}>\r
      <Input label="Default Input" placeholder="No value, no focus" value="" onChangeText={() => {}} />\r
      <Input label="With Value" placeholder="Enter text" value="Sample text value" onChangeText={() => {}} />\r
      <Input label="Email Input" placeholder="email@example.com" value="user@toroloom.app" onChangeText={() => {}} icon="mail-outline" keyboardType="email-address" />\r
      <Input label="Password" placeholder="Enter password" value="" onChangeText={() => {}} secureTextEntry icon="lock-closed-outline" />\r
      <Input label="With Error" placeholder="Enter value" value="invalid" onChangeText={() => {}} error="Please enter a valid value" />\r
      <Input label="Multiline" placeholder="Write a longer message..." value="" onChangeText={() => {}} multiline />\r
    </View>
}`,...M.parameters?.docs?.source}}},N=[`Basic`,`WithValue`,`WithIcon`,`Error`,`Password`,`Multiline`,`AllStates`]}))();export{M as AllStates,E as Basic,k as Error,j as Multiline,A as Password,O as WithIcon,D as WithValue,N as __namedExportsOrder,T as default};