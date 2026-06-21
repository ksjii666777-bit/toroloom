/**
 * Fix remaining lint warnings (88 remaining after auto-fix).
 * Handles patterns the first script couldn't safely auto-fix.
 */
import fs from 'fs';

const files = {};

// ── Helper ────────────────────────────────────────────
function fix(filePath, transforms) {
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP: ${filePath} not found`);
    return;
  }
  let content = fs.readFileSync(filePath, 'utf8');
  const orig = content;
  for (const t of transforms) {
    if (typeof t === 'function') {
      content = t(content);
    } else if (t.from && t.to !== undefined) {
      // Only replace first occurrence unless 'all' is true
      if (t.all) {
        while (content.includes(t.from)) {
          content = content.replace(t.from, t.to);
        }
      } else {
        if (content.includes(t.from)) {
          content = content.replace(t.from, t.to);
        }
      }
    }
  }
  if (content !== orig) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`FIXED: ${filePath}`);
  } else {
    console.log(`NO CHANGE: ${filePath}`);
  }
}

// ====================================================================
// Test files
// ====================================================================

fix('src/__tests__/BrokerConnectScreen.test.tsx', [
  // Line 304: remove unused getByText in 'renders the subtitle asking to switch broker'
  c => c.replace(
    "    const { getByText } = render(\n      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,\n    );\n    await advanceAndFlush();\n\n    expect(getByText('Switch to a different broker below')).toBeDefined();",
    "    render(\n      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,\n    );\n    await advanceAndFlush();\n\n    expect(getByText('Switch to a different broker below')).toBeDefined();"
  ),
  // Same pattern for 'still renders Connect text on non-connected broker cards'
  c => c.replace(
    "    const { getByText } = render(\n      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,\n    );\n    await advanceAndFlush();\n\n    // Zerodha and Groww are not the connected broker (Angel is), so they show Connect\n    expect(getByText('Connect via OAuth')).toBeDefined();",
    "    render(\n      <BrokerConnectScreen navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />,\n    );\n    await advanceAndFlush();\n\n    // Zerodha and Groww are not the connected broker (Angel is), so they show Connect\n    expect(getByText('Connect via OAuth')).toBeDefined();"
  ),
]);

fix('src/__tests__/Button.test.tsx', [
  // Line 152: remove unused getByText in 'renders in disabled state without crashing'
  c => c.replace(
    "    const { getByText, root } = render(\n      <Button title=\"Disabled\" onPress={() => {}} disabled />\n    );",
    "    const { root } = render(\n      <Button title=\"Disabled\" onPress={() => {}} disabled />\n    );"
  ),
  // Line 187: remove unused getByText in 'is disabled when loading is true'
  c => c.replace(
    "    const { getByText } = render(\n      <Button title=\"Loading\" onPress={onPress} loading />\n    );\n    // Title is not rendered when loading, but the root should have disabled state",
    "    render(\n      <Button title=\"Loading\" onPress={onPress} loading />\n    );\n    // Title is not rendered when loading, but the root should have disabled state"
  ),
]);

fix('src/__tests__/ContractNoteUploadScreen.test.tsx', [
  // Line 324: remove unused queryByPlaceholderText in paste toggle tests - this is tricky since it IS used
  // Actually line 324 is in describe('Paste Text Toggle') - let me check which exact test
  // Actually let me look at this more carefully
]);

fix('src/__tests__/IronLockOverlay.test.tsx', [
  // Line 198: remove unused getByText
  c => c.replace(
    "    const { getByText } = renderAndTransition(\n      { lockdown: { status: 'active', triggeredAt: '2025-06-01T10:00:00Z', liftsAt: new Date(Date.now() + 3600000).toISOString(), triggerLoss: 55000, breachedLimit: 'daily_loss' } },\n    );\n    expect(getByText('Financial Bodyguard engaged')).toBeDefined();",
    "    renderAndTransition(\n      { lockdown: { status: 'active', triggeredAt: '2025-06-01T10:00:00Z', liftsAt: new Date(Date.now() + 3600000).toISOString(), triggerLoss: 55000, breachedLimit: 'daily_loss' } },\n    );\n    expect(getByText('Financial Bodyguard engaged')).toBeDefined();"
  ),
]);

console.log('\nDone fixing remaining warnings.');
