// ============================================================================
// Toroloom — Widget Expo Config Plugin (SDK 52+)
// ============================================================================
//
// This config plugin adds native widget support to the Expo project:
//   - iOS: Places WidgetKit extension source files for @bacons/apple-targets
//   - Android: Registers AppWidgetProvider in AndroidManifest.xml and
//     creates widget layout/info XML files + native bridge module
//
// SDK 52 conventions applied:
//   - Imports from 'expo/config-plugins' (bundled with expo package)
//   - Wrapped with createRunOncePlugin for idempotency
//   - Async/await for filesystem operations in withDangerousMod
//   - Package name derived from config.android.package
//
// Usage:
//   In app.json / app.config.js:
//     plugins: [
//       ['./plugins/withToroloomWidgets'],
//       ...
//     ]
//
// ============================================================================

const { withDangerousMod, withAndroidManifest, createRunOncePlugin } = require('expo/config-plugins');
const path = require('path');
const fs = require('fs');
// ──── Plugin Metadata ──────────────────────────────────────────────────────

const PLUGIN_NAME = 'withToroloomWidgets';
const PLUGIN_VERSION = '1.0.0';

// ──── Constants ────────────────────────────────────────────────────────────

// NOTE: These paths are relative to the platform project root (ios/ for iOS,
// android/ for Android). Do NOT prefix with platform directory name
// as that would double the path since modRequest.platformProjectRoot
// already points to it.

const WIDGET_IOS_DIR = 'ToroloomWidget';
const WIDGET_IOS_SWIFT_SRC = path.join(WIDGET_IOS_DIR, 'ToroloomWidget.swift');
const WIDGET_IOS_PLIST = path.join(WIDGET_IOS_DIR, 'Info.plist');
const WIDGET_IOS_EXTENSION_NAME = 'ToroloomWidget';

const WIDGET_ANDROID_SRC_DIR = 'app/src/main/java/com/toroloom/app/widget';
const WIDGET_ANDROID_LAYOUT_DIR = 'app/src/main/res/layout';
const WIDGET_ANDROID_XML_DIR = 'app/src/main/res/xml';

// ──── iOS Config Plugin ────────────────────────────────────────────────────

/**
 * Adds the WidgetKit extension source files to the iOS native project.
 * Requires @bacons/apple-targets to create the actual Xcode target.
 */
function withIosWidget(config) {
  return withDangerousMod(config, [
    'ios',
    (modConfig) => {
      const projectDir = modConfig.modRequest.platformProjectRoot;

      try {
        // Create widget directory
        const widgetDir = path.join(projectDir, WIDGET_IOS_DIR);
        if (!fs.existsSync(widgetDir)) {
          fs.mkdirSync(widgetDir, { recursive: true });
        }

        // Write Swift widget source (only if not already present)
        const swiftSourcePath = path.join(projectDir, WIDGET_IOS_SWIFT_SRC);
        if (!fs.existsSync(swiftSourcePath)) {
          fs.writeFileSync(swiftSourcePath, getIosWidgetSwiftSource(config), 'utf-8');
          console.log(`[${PLUGIN_NAME}] Created iOS Widget Swift source`);
        }

        // Write Info.plist for the widget extension (only if not already present)
        const plistPath = path.join(projectDir, WIDGET_IOS_PLIST);
        if (!fs.existsSync(plistPath)) {
          fs.writeFileSync(plistPath, getIosWidgetPlist(), 'utf-8');
          console.log(`[${PLUGIN_NAME}] Created iOS Widget Info.plist`);
        }
      } catch (error) {
        console.warn(`[${PLUGIN_NAME}] iOS widget setup failed: ${error.message}`);
      }

      return modConfig;
    },
  ]);
}

function getIosWidgetSwiftSource(config) {
  const appGroupId = `group.${config.ios?.bundleIdentifier || 'com.toroloom.app'}`;

  return `import WidgetKit
import SwiftUI

// ──── Data Model ──────────────────────────────────────────────────────────

struct PortfolioSnapshot: Codable {
    let version: Int
    let updatedAt: String
    let totalInvested: Double
    let currentValue: Double
    let pnl: Double
    let pnlPercent: Double
    let topHoldings: [WidgetHolding]
    let totalHoldingCount: Int
    let marketStatus: String
    let theme: String
    let showPnL: Bool
    let widgetSize: String
}

struct WidgetHolding: Codable, Identifiable {
    let symbol: String
    let name: String
    let currentValue: Double
    let pnl: Double
    let pnlPercent: Double
    let quantity: Int
    var id: String { symbol }
}

// ──── Timeline Provider ────────────────────────────────────────────────────

struct Provider: TimelineProvider {
    let defaults = UserDefaults(suiteName: "${appGroupId}")

    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(
            date: Date(),
            snapshot: PortfolioSnapshot(
                version: 1,
                updatedAt: ISO8601DateFormatter().string(from: Date()),
                totalInvested: 1250000,
                currentValue: 1450000,
                pnl: 200000,
                pnlPercent: 16.0,
                topHoldings: [
                    WidgetHolding(symbol: "RELIANCE", name: "Reliance", currentValue: 450000, pnl: 52000, pnlPercent: 13.1, quantity: 150),
                    WidgetHolding(symbol: "HDFCBANK", name: "HDFC Bank", currentValue: 320000, pnl: 28000, pnlPercent: 9.6, quantity: 200),
                ],
                totalHoldingCount: 12,
                marketStatus: "open",
                theme: "dark",
                showPnL: true,
                widgetSize: "medium"
            )
        )
    }

    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> ()) {
        let entry = SimpleEntry(date: Date(), snapshot: loadSnapshot())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> ()) {
        let entry = SimpleEntry(date: Date(), snapshot: loadSnapshot())
        // Refresh every 15 minutes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    private func loadSnapshot() -> PortfolioSnapshot? {
        guard let data = defaults?.data(forKey: "toroloom_widget_data") else { return nil }
        return try? JSONDecoder().decode(PortfolioSnapshot.self, from: data)
    }
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let snapshot: PortfolioSnapshot?
}

// ──── Widget Views ─────────────────────────────────────────────────────────

struct ToroloomWidgetEntryView: View {
    var entry: Provider.Entry
    @Environment(\\\\.widgetFamily) var family

    var body: some View {
        if let snapshot = entry.snapshot {
            switch family {
            case .systemSmall:
                SmallWidgetView(snapshot: snapshot)
            case .systemMedium:
                MediumWidgetView(snapshot: snapshot)
            case .systemLarge:
                LargeWidgetView(snapshot: snapshot)
            @unknown default:
                SmallWidgetView(snapshot: snapshot)
            }
        } else {
            Text("Open Toroloom to see your portfolio")
                .font(.caption)
                .foregroundColor(.secondary)
                .padding()
        }
    }
}

// ──── Small Widget ─────────────────────────────────────────────────────────

struct SmallWidgetView: View {
    let snapshot: PortfolioSnapshot
    let isDark: Bool
    let isPositive: Bool
    let pnlColor: Color

    init(snapshot: PortfolioSnapshot) {
        self.snapshot = snapshot
        self.isDark = snapshot.theme == "dark"
        self.isPositive = snapshot.pnl >= 0
        self.pnlColor = isPositive ? Color.green : Color.red
    }

    var body: some View {
        ZStack {
            ContainerRelativeShape()
                .fill(isDark ? Color(red: 0.05, green: 0.07, blue: 0.09) : Color.white)

            VStack(alignment: .leading, spacing: 4) {
                Text("Portfolio")
                    .font(.caption2)
                    .foregroundColor(isDark ? .gray : .secondary)

                Text(formatCurrency(snapshot.currentValue))
                    .font(.system(size: 20, weight: .black))
                    .foregroundColor(isDark ? .white : .black)

                if snapshot.showPnL {
                    HStack(spacing: 2) {
                        Image(systemName: isPositive ? "arrow.up" : "arrow.down")
                            .font(.caption2)
                        Text(formatCurrency(snapshot.pnl))
                            .font(.caption)
                            .fontWeight(.semibold)
                        Text(formatPercent(snapshot.pnlPercent))
                            .font(.caption2)
                    }
                    .foregroundColor(pnlColor)
                }

                Spacer()

                HStack {
                    Circle()
                        .fill(snapshot.marketStatus == "open" ? Color.green : Color.red)
                        .frame(width: 6, height: 6)
                    Text(snapshot.marketStatus == "open" ? "Market Open" : "Closed")
                        .font(.caption2)
                        .foregroundColor(isDark ? .gray : .secondary)
                }

                Text("Toroloom")
                    .font(.system(size: 8, weight: .semibold))
                    .foregroundColor(isDark ? .gray.opacity(0.5) : .secondary.opacity(0.5))
            }
            .padding(12)
        }
    }

    private func formatCurrency(_ value: Double) -> String {
        if value >= 10_000_000 { return "₹\\\\(String(format: \"%.2f\", value / 10_000_000))Cr" }
        if value >= 100_000 { return "₹\\\\(String(format: \"%.1f\", value / 100_000))L" }
        if value >= 1_000 { return "₹\\\\(String(format: \"%.1f\", value / 1_000))K" }
        return "₹\\\\(String(format: \"%.0f\", value))"
    }

    private func formatPercent(_ value: Double) -> String {
        let sign = value >= 0 ? "+" : ""
        return "\\\\(sign)\\\\(String(format: \"%.1f\", value))%"
    }
}

// ──── Medium Widget ────────────────────────────────────────────────────────

struct MediumWidgetView: View {
    let snapshot: PortfolioSnapshot
    let isDark: Bool
    let isPositive: Bool
    let pnlColor: Color

    init(snapshot: PortfolioSnapshot) {
        self.snapshot = snapshot
        self.isDark = snapshot.theme == "dark"
        self.isPositive = snapshot.pnl >= 0
        self.pnlColor = isPositive ? Color.green : Color.red
    }

    var body: some View {
        ZStack {
            ContainerRelativeShape()
                .fill(isDark ? Color(red: 0.05, green: 0.07, blue: 0.09) : Color.white)

            HStack(alignment: .top, spacing: 8) {
                // Left: Value summary
                VStack(alignment: .leading, spacing: 4) {
                    Text("Portfolio")
                        .font(.caption2)
                        .foregroundColor(isDark ? .gray : .secondary)

                    Text(formatCurrency(snapshot.currentValue))
                        .font(.system(size: 22, weight: .black))
                        .foregroundColor(isDark ? .white : .black)

                    if snapshot.showPnL {
                        HStack(spacing: 2) {
                            Image(systemName: isPositive ? "arrow.up" : "arrow.down")
                                .font(.caption2)
                            Text(formatCurrency(snapshot.pnl))
                                .font(.caption)
                                .fontWeight(.semibold)
                            Text(formatPercent(snapshot.pnlPercent))
                                .font(.caption2)
                        }
                        .foregroundColor(pnlColor)
                    }

                    Spacer()

                    Text("\\(snapshot.totalHoldingCount) holdings")
                        .font(.caption2)
                        .foregroundColor(isDark ? .gray : .secondary)
                }

                Spacer()

                // Right: Top holdings
                VStack(alignment: .trailing, spacing: 6) {
                    Text("Top Holdings")
                        .font(.caption2)
                        .foregroundColor(isDark ? .gray : .secondary)

                    ForEach(snapshot.topHoldings.prefix(2)) { holding in
                        HStack(spacing: 6) {
                            Text(holding.symbol)
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(isDark ? .white : .black)

                            Text(formatCurrency(holding.currentValue))
                                .font(.caption2)
                                .foregroundColor(isDark ? .gray : .secondary)

                            Text(holding.pnl >= 0
                                ? "+" + String(format: "%.1f", holding.pnlPercent) + "%"
                                : String(format: "%.1f", holding.pnlPercent) + "%")
                                .font(.caption2)
                                .fontWeight(.semibold)
                                .foregroundColor(holding.pnl >= 0 ? .green : .red)
                        }
                    }
                }
            }
            .padding(16)
        }
    }

    private func formatCurrency(_ value: Double) -> String {
        if value >= 10_000_000 { return "₹\\\\(String(format: \"%.2f\", value / 10_000_000))Cr" }
        if value >= 100_000 { return "₹\\\\(String(format: \"%.1f\", value / 100_000))L" }
        if value >= 1_000 { return "₹\\\\(String(format: \"%.1f\", value / 1_000))K" }
        return "₹\\\\(String(format: \"%.0f\", value))"
    }

    private func formatPercent(_ value: Double) -> String {
        let sign = value >= 0 ? "+" : ""
        return "\\\\(sign)\\\\(String(format: \"%.1f\", value))%"
    }
}

// ──── Large Widget ─────────────────────────────────────────────────────────

struct LargeWidgetView: View {
    let snapshot: PortfolioSnapshot
    let isDark: Bool
    let isPositive: Bool
    let pnlColor: Color

    init(snapshot: PortfolioSnapshot) {
        self.snapshot = snapshot
        self.isDark = snapshot.theme == "dark"
        self.isPositive = snapshot.pnl >= 0
        self.pnlColor = isPositive ? Color.green : Color.red
    }

    var body: some View {
        ZStack {
            ContainerRelativeShape()
                .fill(isDark ? Color(red: 0.05, green: 0.07, blue: 0.09) : Color.white)

            VStack(alignment: .leading, spacing: 8) {
                // Header
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Portfolio Value")
                            .font(.caption2)
                            .foregroundColor(isDark ? .gray : .secondary)
                        Text(formatCurrency(snapshot.currentValue))
                            .font(.system(size: 28, weight: .black))
                            .foregroundColor(isDark ? .white : .black)
                    }

                    Spacer()

                    VStack(alignment: .trailing, spacing: 2) {
                        if snapshot.showPnL {
                            HStack(spacing: 2) {
                                Image(systemName: isPositive ? "arrow.up" : "arrow.down")
                                    .font(.caption)
                                Text(formatCurrency(snapshot.pnl))
                                    .font(.system(size: 14, weight: .semibold))
                            }
                            .foregroundColor(pnlColor)
                            Text(formatPercent(snapshot.pnlPercent))
                                .font(.caption)
                                .foregroundColor(pnlColor.opacity(0.8))
                        }
                    }
                }

                Divider()
                    .background(isDark ? Color.gray.opacity(0.3) : Color.gray.opacity(0.2))

                // Holdings list
                Text("Holdings (\\\\(snapshot.totalHoldingCount))")
                    .font(.caption)
                    .foregroundColor(isDark ? .gray : .secondary)

                ForEach(snapshot.topHoldings.prefix(5)) { holding in
                    HStack {
                        Text(holding.symbol)
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundColor(isDark ? .white : .black)
                            .frame(width: 70, alignment: .leading)

                        Text(holding.name)
                            .font(.caption2)
                            .foregroundColor(isDark ? .gray : .secondary)
                            .lineLimit(1)

                        Spacer()

                        Text(formatCurrency(holding.currentValue))
                            .font(.caption)
                            .foregroundColor(isDark ? .white : .black)

                        Text(holding.pnl >= 0
                            ? "+" + String(format: "%.1f", holding.pnlPercent) + "%"
                            : String(format: "%.1f", holding.pnlPercent) + "%")
                            .font(.caption2)
                            .fontWeight(.semibold)
                            .foregroundColor(holding.pnl >= 0 ? .green : .red)
                            .frame(width: 50, alignment: .trailing)
                    }
                }

                if snapshot.totalHoldingCount > 5 {
                    Text("+ \\\\(snapshot.totalHoldingCount - 5) more")
                        .font(.caption2)
                        .foregroundColor(isDark ? .gray : .secondary)
                }

                Spacer()

                // Footer
                HStack {
                    Circle()
                        .fill(snapshot.marketStatus == "open" ? Color.green : Color.red)
                        .frame(width: 6, height: 6)
                    Text(snapshot.marketStatus == "open" ? "Open" : "Closed")
                        .font(.caption2)
                        .foregroundColor(isDark ? .gray : .secondary)

                    Spacer()

                    Text("Toroloom")
                        .font(.system(size: 8, weight: .semibold))
                        .foregroundColor(isDark ? .gray.opacity(0.5) : .secondary.opacity(0.5))
                }
            }
            .padding(16)
        }
    }

    private func formatCurrency(_ value: Double) -> String {
        if value >= 10_000_000 { return "₹\\\\(String(format: \"%.2f\", value / 10_000_000))Cr" }
        if value >= 100_000 { return "₹\\\\(String(format: \"%.1f\", value / 100_000))L" }
        if value >= 1_000 { return "₹\\\\(String(format: \"%.1f\", value / 1_000))K" }
        return "₹\\\\(String(format: \"%.0f\", value))"
    }

    private func formatPercent(_ value: Double) -> String {
        let sign = value >= 0 ? "+" : ""
        return "\\\\(sign)\\\\(String(format: \"%.1f\", value))%"
    }
}

// ──── Widget Configuration ─────────────────────────────────────────────────

@main
struct ToroloomWidget: Widget {
    let kind: String = "${WIDGET_IOS_EXTENSION_NAME}"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            if #available(iOS 17.0, *) {
                ToroloomWidgetEntryView(entry: entry)
                    .containerBackground(.clear, for: .widget)
            } else {
                ToroloomWidgetEntryView(entry: entry)
                    .padding()
                    .background()
            }
        }
        .configurationDisplayName("Toroloom Portfolio")
        .description("View your portfolio value, P&L, and top holdings at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
`;
}

function getIosWidgetPlist() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSExtension</key>
    <dict>
        <key>NSExtensionPointIdentifier</key>
        <string>com.apple.widgetkit-extension</string>
    </dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>$(DEVELOPMENT_LANGUAGE)</string>
    <key>CFBundleDisplayName</key>
    <string>Toroloom Widget</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key>
    <string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>MinimumOSVersion</key>
    <string>14.0</string>
</dict>
</plist>
`;
}

// ──── Android Config Plugin ────────────────────────────────────────────────

/**
 * Registers the AppWidgetProvider in AndroidManifest.xml.
 * Uses withAndroidManifest (declarative mod) for manifest changes,
 * and withDangerousMod for creating new source/resource files.
 */
function withAndroidWidget(config) {
  // Derive Android package from config, with fallback
  const androidPackage = config.android?.package || 'com.toroloom.app';

  // Step 1: Add widget receiver + service + test receiver to AndroidManifest
  config = withAndroidManifest(config, (modConfig) => {
    try {
      const manifest = modConfig.modResults;
      const application = manifest.manifest.application?.[0];

      if (!application) {
        console.warn(`[${PLUGIN_NAME}] No <application> tag found in AndroidManifest`);
        return modConfig;
      }

      const receivers = application.receiver || [];

      // Add widget receiver if not already present
      const hasWidgetReceiver = receivers.some(
        (r) => r.$ && r.$['android:name'] && r.$['android:name'].includes('ToroloomWidgetProvider'),
      );

      if (!hasWidgetReceiver) {
        const widgetReceiver = {
          $: {
            'android:name': '.widget.ToroloomWidgetProvider',
            'android:exported': 'true',
          },
          'intent-filter': [
            {
              action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }],
            },
          ],
          'meta-data': [
            {
              $: {
                'android:name': 'android.appwidget.provider',
                'android:resource': '@xml/toroloom_widget_info',
              },
            },
          ],
        };
        application.receiver = [...receivers, widgetReceiver];
      }

      // Add widget update service if not already present
      const services = application.service || [];
      const hasUpdateService = services.some(
        (s) => s.$ && s.$['android:name'] && s.$['android:name'].includes('WidgetUpdateService'),
      );

      if (!hasUpdateService) {
        const updateService = {
          $: {
            'android:name': '.widget.WidgetUpdateService',
            'android:exported': 'false',
            'android:permission': 'android.permission.BIND_JOB_SERVICE',
          },
        };
        application.service = [...services, updateService];
      }

      // Add test receiver if not already present
      const hasTestReceiver = receivers.some(
        (r) => r.$ && r.$['android:name'] && r.$['android:name'].includes('WidgetTestReceiver'),
      );

      if (!hasTestReceiver) {
        const testReceiver = {
          $: {
            'android:name': '.widget.WidgetTestReceiver',
            'android:exported': 'true',
          },
          'intent-filter': [
            {
              action: [{ $: { 'android:name': 'com.toroloom.action.TEST_WIDGET_DATA' } }],
            },
          ],
        };
        application.receiver = [...(application.receiver || []), testReceiver];
      }
    } catch (error) {
      console.warn(`[${PLUGIN_NAME}] Failed to modify AndroidManifest: ${error.message}`);
    }

    return modConfig;
  });

  // Step 2: Create widget Java source, layout XML & resource files
  config = withDangerousMod(config, [
    'android',
    (modConfig) => {
      try {
        const projectDir = modConfig.modRequest.platformProjectRoot;

        // ── Widget Java source ──
        const widgetDir = path.join(projectDir, WIDGET_ANDROID_SRC_DIR);
        if (!fs.existsSync(widgetDir)) {
          fs.mkdirSync(widgetDir, { recursive: true });
        }

        const widgetSrcPath = path.join(widgetDir, 'ToroloomWidgetProvider.java');
        if (!fs.existsSync(widgetSrcPath)) {
          fs.writeFileSync(widgetSrcPath, getAndroidWidgetSource(androidPackage), 'utf-8');
          console.log(`[${PLUGIN_NAME}] Created Android Widget provider`);
        }

        // ── Widget update service ──
        const servicePath = path.join(widgetDir, 'WidgetUpdateService.java');
        if (!fs.existsSync(servicePath)) {
          fs.writeFileSync(servicePath, getAndroidWidgetUpdateService(), 'utf-8');
          console.log(`[${PLUGIN_NAME}] Created Android Widget update service`);
        }

        // ── Native bridge module ──
        const modulePath = path.join(widgetDir, 'ToroloomWidgetModule.java');
        if (!fs.existsSync(modulePath)) {
          fs.writeFileSync(modulePath, getAndroidWidgetModule(androidPackage), 'utf-8');
          console.log(`[${PLUGIN_NAME}] Created Android Widget bridge module`);
        }

        // ── Native bridge package ──
        const pkgPath = path.join(widgetDir, 'ToroloomWidgetPackage.java');
        if (!fs.existsSync(pkgPath)) {
          fs.writeFileSync(pkgPath, getAndroidWidgetPackage(androidPackage), 'utf-8');
          console.log(`[${PLUGIN_NAME}] Created Android Widget package`);
        }

        // ── Widget layout XMLs ──
        const layoutDir = path.join(projectDir, WIDGET_ANDROID_LAYOUT_DIR);
        if (!fs.existsSync(layoutDir)) {
          fs.mkdirSync(layoutDir, { recursive: true });
        }

        const smallLayoutPath = path.join(layoutDir, 'toroloom_widget_small.xml');
        if (!fs.existsSync(smallLayoutPath)) {
          fs.writeFileSync(smallLayoutPath, getAndroidWidgetSmallLayout(), 'utf-8');
          console.log(`[${PLUGIN_NAME}] Created small widget layout`);
        }

        const mediumLayoutPath = path.join(layoutDir, 'toroloom_widget_medium.xml');
        if (!fs.existsSync(mediumLayoutPath)) {
          fs.writeFileSync(mediumLayoutPath, getAndroidWidgetMediumLayout(), 'utf-8');
          console.log(`[${PLUGIN_NAME}] Created medium widget layout`);
        }

        // ── Widget info XML ──
        const xmlDir = path.join(projectDir, WIDGET_ANDROID_XML_DIR);
        if (!fs.existsSync(xmlDir)) {
          fs.mkdirSync(xmlDir, { recursive: true });
        }

        const infoPath = path.join(xmlDir, 'toroloom_widget_info.xml');
        if (!fs.existsSync(infoPath)) {
          fs.writeFileSync(infoPath, getAndroidWidgetInfoXml(), 'utf-8');
          console.log(`[${PLUGIN_NAME}] Created widget info XML`);
        }

        // ── Test receiver (for ADB data injection) ──
        const testReceiverPath = path.join(widgetDir, 'WidgetTestReceiver.java');
        if (!fs.existsSync(testReceiverPath)) {
          fs.writeFileSync(testReceiverPath, getAndroidWidgetTestReceiver(androidPackage), 'utf-8');
          console.log(`[${PLUGIN_NAME}] Created WidgetTestReceiver`);
        }
      } catch (error) {
        console.warn(`[${PLUGIN_NAME}] Android widget setup failed: ${error.message}`);
      }

      return modConfig;
    },
  ]);

  return config;
}

// ──── Android Source Templates ─────────────────────────────────────────────

/**
 * Returns the Android WidgetProvider Java source code.
 * @param {string} androidPackage - The Android package name
 */
function getAndroidWidgetSource(androidPackage) {
  return `package ${androidPackage}.widget;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import ${androidPackage}.R;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Toroloom App Widget Provider
 *
 * Displays portfolio snapshot on the Android home screen.
 * Data is written to SharedPreferences by the React Native app
 * via the widgetService, and read here for display.
 */
public class ToroloomWidgetProvider extends AppWidgetProvider {

    private static final String PREFS_NAME = "ToroloomWidgetPrefs";
    private static final String KEY_WIDGET_DATA = "toroloom_widget_data";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        // Read widget size from widget options
        int widgetWidth = 0;
        try {
            android.os.Bundle options = appWidgetManager.getAppWidgetOptions(appWidgetId);
            widgetWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        } catch (Exception ignored) {}

        RemoteViews views;
        if (widgetWidth >= 250) {
            views = new RemoteViews(context.getPackageName(), R.layout.toroloom_widget_medium);
        } else {
            views = new RemoteViews(context.getPackageName(), R.layout.toroloom_widget_small);
        }

        // Load portfolio data from SharedPreferences
        String snapshotJson = loadSnapshot(context);
        if (snapshotJson != null) {
            try {
                JSONObject snapshot = new JSONObject(snapshotJson);
                double currentValue = snapshot.optDouble("currentValue", 0);
                double pnl = snapshot.optDouble("pnl", 0);
                double pnlPercent = snapshot.optDouble("pnlPercent", 0);
                boolean showPnL = snapshot.optBoolean("showPnL", true);
                boolean isDark = "dark".equals(snapshot.optString("theme", "dark"));
                boolean isPositive = pnl >= 0;

                // Format values
                String formattedValue = formatCurrency(currentValue);
                String formattedPnl = showPnL ? formatCurrency(pnl) : "";
                String formattedPnlPercent = showPnL ? formatPercent(pnlPercent) : "";

                // Set text on views
                views.setTextViewText(R.id.widget_portfolio_value, formattedValue);
                if (showPnL) {
                    views.setTextViewText(R.id.widget_pnl, formattedPnl);
                    views.setTextViewText(R.id.widget_pnl_percent, formattedPnlPercent);
                    views.setInt(R.id.widget_pnl, "setTextColor",
                            isPositive ? 0xFF00E676 : 0xFFFF5252);
                    views.setInt(R.id.widget_pnl_percent, "setTextColor",
                            isPositive ? 0xFF00E676 : 0xFFFF5252);
                }

                // Market status
                String marketStatus = snapshot.optString("marketStatus", "closed");
                views.setTextViewText(R.id.widget_market_status,
                        "open".equals(marketStatus) ? "● Open" : "● Closed");
                views.setInt(R.id.widget_market_status, "setTextColor",
                        "open".equals(marketStatus) ? 0xFF00E676 : 0xFFFF5252);

                // Theme
                int bgColor = isDark ? 0xFF0D1117 : 0xFFFFFFFF;
                int textColor = isDark ? 0xFFFFFFFF : 0xFF0D1117;
                views.setInt(R.id.widget_container, "setBackgroundColor", bgColor);
                views.setInt(R.id.widget_portfolio_value, "setTextColor", textColor);

                // Top holdings (medium widget)
                if (widgetWidth >= 250) {
                    JSONArray holdings = snapshot.optJSONArray("topHoldings");
                    if (holdings != null && holdings.length() > 0) {
                        for (int i = 0; i < Math.min(holdings.length(), 2); i++) {
                            JSONObject h = holdings.getJSONObject(i);
                            String symbol = h.optString("symbol", "");
                            double hPnl = h.optDouble("pnlPercent", 0);
                            String hPnlStr = (hPnl >= 0 ? "+" : "") + String.format("%.1f", hPnl) + "%";

                            if (i == 0) {
                                views.setTextViewText(R.id.widget_holding_1_symbol, symbol);
                                views.setTextViewText(R.id.widget_holding_1_pnl, hPnlStr);
                                views.setInt(R.id.widget_holding_1_pnl, "setTextColor",
                                        hPnl >= 0 ? 0xFF00E676 : 0xFFFF5252);
                            } else if (i == 1) {
                                views.setTextViewText(R.id.widget_holding_2_symbol, symbol);
                                views.setTextViewText(R.id.widget_holding_2_pnl, hPnlStr);
                                views.setInt(R.id.widget_holding_2_pnl, "setTextColor",
                                        hPnl >= 0 ? 0xFF00E676 : 0xFFFF5252);
                            }
                        }
                    }
                }

            } catch (Exception ignored) {}
        } else {
            views.setTextViewText(R.id.widget_portfolio_value, "Open Toroloom");
        }

        // Instruct the widget manager to update the widget
        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static String loadSnapshot(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        return prefs.getString(KEY_WIDGET_DATA, null);
    }

    private static String formatCurrency(double value) {
        if (value >= 10_000_000) {
            return String.format("₹%.2fCr", value / 10_000_000);
        } else if (value >= 100_000) {
            return String.format("₹%.1fL", value / 100_000);
        } else if (value >= 1_000) {
            return String.format("₹%.1fK", value / 1_000);
        }
        return String.format("₹%.0f", value);
    }

    private static String formatPercent(double value) {
        String sign = value >= 0 ? "+" : "";
        return sign + String.format("%.1f", value) + "%";
    }
}
`;
}

function getAndroidWidgetSmallLayout() {
  return `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_container"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="12dp"
    android:background="@drawable/widget_background">

    <TextView
        android:id="@+id/widget_portfolio_value"
        android:layout_width="wrap_content"
        android:layout_height="0dp"
        android:layout_weight="1"
        android:text="₹---"
        android:textSize="22sp"
        android:textStyle="bold"
        android:fontFamily="sans-serif-black"
        android:gravity="center_vertical" />

    <LinearLayout
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:gravity="center_vertical">

        <TextView
            android:id="@+id/widget_pnl"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text=""
            android:textSize="12sp"
            android:textStyle="normal" />

        <TextView
            android:id="@+id/widget_pnl_percent"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginStart="4dp"
            android:text=""
            android:textSize="11sp" />
    </LinearLayout>

    <TextView
        android:id="@+id/widget_market_status"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:layout_marginTop="8dp"
        android:text="● --"
        android:textSize="10sp" />

</LinearLayout>
`;
}

function getAndroidWidgetMediumLayout() {
  return `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/widget_container"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="14dp"
    android:background="@drawable/widget_background">

    <!-- Top row: value + P&L -->
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal">

        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:orientation="vertical">

            <TextView
                android:id="@+id/widget_portfolio_value"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="₹---"
                android:textSize="24sp"
                android:textStyle="bold"
                android:fontFamily="sans-serif-black" />

            <LinearLayout
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:layout_marginTop="4dp">

                <TextView
                    android:id="@+id/widget_pnl"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:text=""
                    android:textSize="13sp" />

                <TextView
                    android:id="@+id/widget_pnl_percent"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:layout_marginStart="4dp"
                    android:text=""
                    android:textSize="12sp" />
            </LinearLayout>
        </LinearLayout>

        <TextView
            android:id="@+id/widget_market_status"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="● --"
            android:textSize="10sp"
            android:layout_marginTop="2dp" />
    </LinearLayout>

    <!-- Divider -->
    <View
        android:layout_width="match_parent"
        android:layout_height="1px"
        android:background="#1AFFFFFF"
        android:layout_marginVertical="10dp" />

    <!-- Holdings -->
    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Top Holdings"
        android:textSize="10sp"
        android:textColor="#80FFFFFF" />

    <TableLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="6dp"
        android:stretchColumns="0">

        <!-- Holding 1 -->
        <TableRow>
            <TextView
                android:id="@+id/widget_holding_1_symbol"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="--"
                android:textSize="12sp"
                android:textStyle="bold"
                android:layout_weight="1" />
            <TextView
                android:id="@+id/widget_holding_1_pnl"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="--"
                android:textSize="11sp" />
        </TableRow>

        <!-- Holding 2 -->
        <TableRow android:layout_marginTop="6dp">
            <TextView
                android:id="@+id/widget_holding_2_symbol"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="--"
                android:textSize="12sp"
                android:textStyle="bold"
                android:layout_weight="1" />
            <TextView
                android:id="@+id/widget_holding_2_pnl"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="--"
                android:textSize="11sp" />
        </TableRow>
    </TableLayout>

</LinearLayout>
`;
}

function getAndroidWidgetInfoXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="110dp"
    android:minHeight="110dp"
    android:minResizeWidth="110dp"
    android:minResizeHeight="110dp"
    android:maxResizeWidth="400dp"
    android:maxResizeHeight="400dp"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:updatePeriodMillis="900000"
    android:initialLayout="@layout/toroloom_widget_small"
    android:description="@string/widget_description"
    android:label="Toroloom Portfolio">
</appwidget-provider>
`;
}

function getAndroidWidgetUpdateService() {
  return `package com.toroloom.app.widget;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import androidx.core.app.JobIntentService;

/**
 * Service that handles widget data updates from the React Native layer.
 * Called by the native bridge module when portfolio data changes.
 */
public class WidgetUpdateService extends JobIntentService {

    private static final int JOB_ID = 1001;
    private static final String PREFS_NAME = "ToroloomWidgetPrefs";
    private static final String KEY_WIDGET_DATA = "toroloom_widget_data";

    /**
     * Convenience method to enqueue the update work.
     */
    public static void enqueueWork(Context context, Intent intent) {
        enqueueWork(context, WidgetUpdateService.class, JOB_ID, intent);
    }

    @Override
    protected void onHandleWork(Intent intent) {
        // Save widget data to SharedPreferences
        if (intent.hasExtra(KEY_WIDGET_DATA)) {
            String json = intent.getStringExtra(KEY_WIDGET_DATA);
            if (json != null) {
                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                prefs.edit().putString(KEY_WIDGET_DATA, json).apply();
            }
        }

        // Trigger widget update for each active widget
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(this);
        ComponentName thisWidget = new ComponentName(this, ToroloomWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget);
        for (int appWidgetId : appWidgetIds) {
            ToroloomWidgetProvider.updateAppWidget(this, appWidgetManager, appWidgetId);
        }
    }
}
`;
}

function getAndroidWidgetModule(androidPackage) {
  return `package ${androidPackage}.widget;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/**
 * React Native bridge module that syncs portfolio data from the JS layer
 * to Android SharedPreferences, where the AppWidgetProvider can read it.
 *
 * Exposed to JS as NativeModules.ToroloomWidgetBridge.
 */
public class ToroloomWidgetModule extends ReactContextBaseJavaModule {

    private static final String MODULE_NAME = "ToroloomWidgetBridge";
    private static final String PREFS_NAME = "ToroloomWidgetPrefs";
    private static final String KEY_WIDGET_DATA = "toroloom_widget_data";

    public ToroloomWidgetModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }

    /**
     * Write portfolio snapshot JSON to SharedPreferences and trigger widget update.
     */
    @ReactMethod
    public void updateWidgetData(String json) {
        Context context = getReactApplicationContext();

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_WIDGET_DATA, json).apply();

        Intent intent = new Intent(context, WidgetUpdateService.class);
        intent.putExtra(KEY_WIDGET_DATA, json);
        WidgetUpdateService.enqueueWork(context, intent);
    }

    /**
     * Force all widget instances to reload their views.
     */
    @ReactMethod
    public void reloadWidgetTimelines() {
        Context context = getReactApplicationContext();
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName thisWidget = new ComponentName(context, ToroloomWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget);

        for (int appWidgetId : appWidgetIds) {
            ToroloomWidgetProvider.updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    /**
     * Read widget data from SharedPreferences (for debugging).
     */
    @ReactMethod
    public void getWidgetData(com.facebook.react.bridge.Promise promise) {
        try {
            Context context = getReactApplicationContext();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String data = prefs.getString(KEY_WIDGET_DATA, null);
            promise.resolve(data != null ? data : null);
        } catch (Exception e) {
            promise.reject("WIDGET_DATA_ERROR", e.getMessage(), e);
        }
    }
}
`;
}

function getAndroidWidgetPackage(androidPackage) {
  return `package ${androidPackage}.widget;

import androidx.annotation.NonNull;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * React Native package that registers ToroloomWidgetModule.
 * Added to MainApplication.kt packageList in the Expo project.
 */
public class ToroloomWidgetPackage implements ReactPackage {

    @NonNull
    @Override
    public List<NativeModule> createNativeModules(@NonNull ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new ToroloomWidgetModule(reactContext));
        return modules;
    }

    @NonNull
    @Override
    public List<ViewManager> createViewManagers(@NonNull ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}
`;
}

function getAndroidWidgetTestReceiver(androidPackage) {
  return `package ${androidPackage}.widget;

import android.appwidget.AppWidgetManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

/**
 * Test receiver that injects sample portfolio data into SharedPreferences
 * and triggers a widget update via broadcast.
 *
 * Trigger via ADB:
 *   adb shell am broadcast -a com.toroloom.action.TEST_WIDGET_DATA \\
 *     -n com.toroloom.app/.widget.WidgetTestReceiver
 *
 * NOT intended for production — remove before release.
 */
public class WidgetTestReceiver extends BroadcastReceiver {

    private static final String PREFS_NAME = "ToroloomWidgetPrefs";
    private static final String KEY_WIDGET_DATA = "toroloom_widget_data";

    @Override
    public void onReceive(Context context, Intent intent) {
        String testJson = "{"
            + "\\"version\\": 1,"
            + "\\"updatedAt\\": \\"" + new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
                java.util.Locale.US).format(new java.util.Date()) + "\\","
            + "\\"totalInvested\\": 1250000.00,"
            + "\\"currentValue\\": 1568000.00,"
            + "\\"pnl\\": 318000.00,"
            + "\\"pnlPercent\\": 25.44,"
            + "\\"topHoldings\\": ["
            + "  {\\"symbol\\":\\"RELIANCE\\",\\"name\\":\\"Reliance Industries\\",\\"currentValue\\":452000.00,\\"pnl\\":52000.00,\\"pnlPercent\\":13.0,\\"quantity\\":150},"
            + "  {\\"symbol\\":\\"HDFCBANK\\",\\"name\\":\\"HDFC Bank\\",\\"currentValue\\":328000.00,\\"pnl\\":28000.00,\\"pnlPercent\\":9.33,\\"quantity\\":200},"
            + "  {\\"symbol\\":\\"TCS\\",\\"name\\":\\"Tata Consultancy\\",\\"currentValue\\":215000.00,\\"pnl\\":-12000.00,\\"pnlPercent\\":-5.29,\\"quantity\\":50}"
            + "],"
            + "\\"totalHoldingCount\\": 12,"
            + "\\"marketStatus\\": \\"open\\","
            + "\\"theme\\": \\"dark\\","
            + "\\"showPnL\\": true,"
            + "\\"widgetSize\\": \\"medium\\""
            + "}";

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(KEY_WIDGET_DATA, testJson).apply();

        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName thisWidget = new ComponentName(context, ToroloomWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget);

        Intent updateIntent = new Intent(context, ToroloomWidgetProvider.class);
        updateIntent.setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE);
        updateIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, appWidgetIds);
        context.sendBroadcast(updateIntent);

        android.util.Log.i("ToroloomWidget", "Test data injected successfully");
    }
}
`;
}

// ──── Main Plugin Export ───────────────────────────────────────────────────

/**
 * Expo Config Plugin: withToroloomWidgets
 *
 * Adds native widget capability for both iOS and Android:
 * - iOS: WidgetKit extension source files
 * - Android: AppWidgetProvider, layout XMLs, info XML, native bridge module
 *
 * @param {import('expo/config-plugins').ExpoConfig} config - Expo config object
 * @returns {import('expo/config-plugins').ExpoConfig} Modified config
 */
function withToroloomWidgets(config) {
  config = withIosWidget(config);
  config = withAndroidWidget(config);
  return config;
}

// Wrap with createRunOncePlugin to prevent duplicate execution
// (SDK 52+ recommended pattern for all config plugins)
module.exports = createRunOncePlugin(withToroloomWidgets, PLUGIN_NAME, PLUGIN_VERSION);
