"""
Final fix: properly remove ALL old useT mock artifacts (const declarations,
resolveT functions, vi.mock calls) and insert clean new mocks.
"""

import json
import os

# ==== Translation data (exactly as before) ====

ipos = {
    'dashboard': 'IPO Dashboard',
    'subtitleSummary': '{{open}} open \u00b7 {{upcoming}} upcoming \u00b7 {{listed}} listed',
    'activeIPOs': 'Active IPOs',
    'myApps': 'My Apps ({{count}})',
    'showingCount': '{{count}} IPO',
    'showingCount_plural': '{{count}} IPOs',
    'applyViaUPI': 'Apply via UPI',
    'noIPOs': 'No IPOs found',
    'noIPOsSub': 'Check back later for new IPOs',
    'priceBand': 'Price Band',
    'lot': 'Lot',
    'shares': 'shares',
    'minInvest': 'Min Investment',
    'gmp': 'GMP',
    'expectedListing': 'Exp. Listing',
    'subscriptionLabel': '{{value}}x',
    'subQIB': 'QIB',
    'subHNI': 'HNI',
    'subRetail': 'Ret',
    'openLabel': 'Open: {{date}}',
    'listingLabel': 'Listing: {{date}}',
    'statusOpen': 'Open Now',
    'statusListed': 'Listed',
    'statusUpcoming': 'Upcoming',
    'lots': 'Lots',
    'sharesLabel': 'Shares',
    'price': 'Price',
    'amount': 'Amount',
    'allottedLabel': 'Allotted',
    'listingPriceLabel': 'Listing Price',
    'gain': 'Gain',
    'upiLabel': 'UPI: {{id}}',
    'appliedLabel': 'Applied: {{date}}',
    'applyTitle': 'Apply via UPI',
    'numberOfLots': 'Number of Lots',
    'custom': 'Custom',
    'lotsSuffix': 'lots',
    'bidPriceLabel': 'Bid Price (\u20b9)',
    'cutOff': 'Cut-off',
    'higher': 'Higher',
    'upiIdLabel': 'UPI ID',
    'upiPlaceholder': 'e.g., name@hdfc',
    'pricePerShare': 'Price per share',
    'totalAmount': 'Total Amount',
    'submitting': 'Submitting...',
    'applyFor': 'Apply for {{amount}}',
    'upiInfo': 'Amount will be blocked in UPI until allotment',
    'invalidUpiTitle': 'Invalid UPI ID',
    'invalidUpiMsg': 'Please enter a valid UPI ID (e.g., name@bank).',
    'invalidLotsTitle': 'Invalid Lots',
    'invalidLotsMsg': 'Please select a valid number of lots.',
    'appSubmittedTitle': 'Application Submitted \u2705',
    'submitError': 'Failed to submit application',
    'filterAll': 'All',
    'filterOpen': 'Open',
    'filterUpcoming': 'Upcoming',
    'filterClosed': 'Closed',
    'filterListed': 'Listed',
    'filterActive': 'Active',
    'total': 'Total',
    'appSubmitted': 'Submitted',
    'appAllotted': 'Allotted',
    'appNotAllotted': 'Not Allotted',
    'invested': 'Invested',
    'profit': 'Profit',
    'noApplications': 'No Applications',
    'noAppsSub': 'Apply to an open IPO to see it here',
    'appCount': '{{count}}',
    'appCount_plural': '{{count}}',
    'appsTracked': '{{count}} applications tracked',
}

profile = {
    'profileKyc': 'Profile & KYC',
    'availableBalance': 'Available Balance',
    'lifetimeXp': 'Lifetime XP',
    'accountType': 'Account Type',
    'tradingAccount': 'Trading Account',
    'dpId': 'DP ID',
    'broker': 'Broker',
    'accountOpened': 'Account Opened',
    'panLabel': 'PAN',
    'emailLabel': 'Email',
    'phoneLabel': 'Phone',
    'personalInformation': 'Personal Information',
    'editProfile': 'Edit Profile',
    'editProfileSub': 'Name, email, phone',
    'changePassword': 'Change Password',
    'changePasswordSub': 'Update your login password',
    'notificationPreferences': 'Notification Preferences',
    'notificationPrefsSub': 'Manage alerts and updates',
    'kycStatus': 'KYC Status',
    'kycVerified': 'KYC Verified',
    'kycAndBanks': 'KYC & Banks',
    'accountDetails': 'Account Details',
    'accountDetailsSub': 'Your trading account information',
    'kycHelperText': 'Tap on a step to start verification.',
    'linkedBanks': 'Linked Bank Accounts',
    'banksLinked': '{{count}} account(s) linked',
    'primary': 'Primary',
    'ifsc': 'IFSC',
    'addBankAccount': 'Add Bank Account',
    'sectionInvestments': 'Investments',
    'sectionLearnAndGrow': 'Learn & Grow',
    'sectionAccount': 'Account',
    'referral': 'Refer & Earn',
    'homeWidget': 'Home Widget',
    'upiSettings': 'UPI Settings',
    'logout': 'Log Out',
    'help': 'Help & Support',
    'securitySettings': 'Security Settings',
    'replayTour': 'Replay Tour',
    'replayTourConfirm': 'This will restart the onboarding walkthrough.',
    'startTour': 'Start Tour',
    'goPremium': 'Go Premium',
    'paymentHistory': 'Payment History',
    'portfolioAlerts': 'Portfolio Alerts',
    'riskSettings': 'Risk Settings',
    'connectBroker': 'Connect Broker',
    'fnoTrading': 'F&O Trading',
    'opStrategies': 'Op. Strategies',
    'tradeHistory': 'Trade History',
    'openOrders': 'Open Orders',
    'title': 'Profile',
    'reports': 'Reports',
    'messages': 'Messages',
    'panVerification': 'PAN Verification',
    'aadhaarVerification': 'Aadhaar Verification',
    'digilocker': 'DigiLocker',
    'bankLinking': 'Bank Linking',
}

trading = {
    'buySecurities': 'Buy Securities',
    'sellSecurities': 'Sell Securities',
    'productType': 'Product Type',
    'marketDesc': 'Buy/Sell at current market price',
    'limitDesc': 'Execute only at your specified price or better',
    'stopLossDesc': 'Convert to market order when trigger price is hit',
    'stopLossMarketDesc': 'Market order that activates at trigger price',
    'cncDesc': 'Delivery - settle with actual shares',
    'misDesc': 'Intraday - square off by EOD',
    'nrmlDesc': 'Normal - for futures & options',
    'owned': '(Owned: {{count}})',
    'max': 'Max',
    'limitPrice': 'Limit Price (\u20b9)',
    'triggerPrice': 'Trigger Price (\u20b9)',
    'enterTriggerPrice': 'Enter trigger price',
    'pricePerShare': 'Price per share',
    'shares': 'shares',
    'estimatedTotal': 'Estimated Total',
    'grandTotal': 'Grand Total',
    'balanceAvailable': 'Available: {{amount}}',
    'availableBalance': 'Available Balance',
    'goBack': 'Go Back',
    'processing': 'Processing...',
    'orderPlacedSuccessfully': 'Order Placed Successfully!',
    'bought': 'Bought',
    'sold': 'Sold',
    'of': 'of',
    'price': 'Price',
    'time': 'Time',
    'done': 'Done',
    'orderFailed': 'Order Failed',
    'quantityLabel': 'Quantity',
    'orderTypeLabel': 'Order Type',
}

education = {
    'myCourses': 'My Courses',
    'createManageSubtitle': 'Create and manage your own courses',
    'total': 'Total',
    'published': 'Published',
    'drafts': 'Drafts',
    'students': 'Students',
    'createNewCourse': 'Create New Course',
    'noCoursesYet': 'No courses yet',
    'noCoursesSubtitle': 'Tap to start building your first course!',
    'submitForReview': 'Submit for Review',
    'cannotSubmit': 'Cannot Submit',
    'cannotSubmitMsg': 'Please add a title and at least one lesson.',
    'archiveCourse': 'Archive Course',
    'restoreCourse': 'Restore Course',
    'duplicate': 'Duplicate',
    'deleteCourse': 'Delete Course',
    'deleteCourseConfirm': 'Are you sure you want to delete "{{title}}"?',
    'untitledCourse': 'Untitled Course',
    'noDescription': 'No description yet',
    'pending': 'Pending',
    'reviewStatus': 'Review Status',
    'pendingReview': '\U0001f7e1 Pending Review',
    'approved': 'Approved',
    'rejected': 'Rejected',
    'needsChanges': '\u274c Rejected - Needs Changes',
    'submitted': 'Submitted',
    'courseOptions': 'Course Options',
    'communityCourses': 'Community Courses',
    'communitySubtitle': 'Discover courses created by fellow traders',
    'searchCoursesCreators': 'Search courses, creators, or topics...',
    'featuredCourses': 'Featured Courses',
    'title': 'Courses',
    'allCommunityCourses': 'All Community Courses',
    'filteredResults': 'Filtered ({{count}})',
    'noCoursesFound': 'No courses found',
    'noCoursesMatch': 'No courses match query. Try a different search term.',
    'noCommunityCourses': 'No published community courses yet. Check back later!',
    'enroll': 'Enroll',
    'byCreator': 'by {{name}}',
    'enrolled': 'Enrolled',
    'lessonsCount': '{{count}} lessons',
    'courseNotFound': 'Course not found',
    'courseProgress': 'Course Progress',
    'completed': 'Completed',
    'remainingCount': 'Remaining',
    'aboutThisCourse': 'About this Course',
    'duration': 'Duration',
    'lessonsProgress': 'Lessons ({{completed}}/{{total}})',
    'lessonDone': 'Done',
    'lessonQuiz': 'Quiz',
    'nextLesson': 'Next Lesson',
    'startCourse': 'Start Course',
    'continueLearning': 'Continue',
    'viewCertificate': 'View Certificate',
    'getCertificate': '\U0001f393 Get Certificate',
    'rating': 'rating',
    'learningPaths': 'Learning Paths',
    'learningPathsSubtitle': 'Curated sequences to master the markets',
    'paths': 'Paths',
    'learners': 'Learners',
    'lessonsLabel': 'Lessons',
    'coursesProgress': '{{completed}}/{{total}} courses \u00b7 {{percent}}% complete',
    'continuePath': 'Continue Path \u2192',
    'startPath': 'Start Path \u2192',
    'sortCategory': 'Category',
    'allLevels': 'All Levels',
    'beginner': 'Beginner',
    'intermediate': 'Intermediate',
    'advanced': 'Advanced',
}

time_translations = {
    'justNow': 'just now',
    'minutesAgo': '{{count}}m ago',
    'hoursAgo': '{{count}}h ago',
    'daysAgo': '{{count}}d ago',
}

reports = {
    'title': 'Reports',
    'subtitle': 'Download and manage your reports',
    'contractNotes': 'Contract Notes',
    'download': 'Download',
    'upload': 'Upload',
    'uploadContractNote': 'Upload Contract Note',
    'selectFile': 'Select File',
    'noReports': 'No reports yet',
    'noReportsSub': 'Upload a contract note to get started',
    'processing': 'Processing...',
    'processed': 'Processed',
    'failed': 'Failed',
    'delete': 'Delete',
    'deleteConfirm': 'Are you sure you want to delete this report?',
    'reportType': 'Report Type',
    'dateRange': 'Date Range',
    'apply': 'Apply',
    'clear': 'Clear',
    'filter': 'Filter',
    'downloadPdf': 'Download PDF',
    'share': 'Share',
    'print': 'Print',
    'taxReport': 'Tax Report',
    'pAndL': 'P&L Statement',
    'tradeConfirmation': 'Trade Confirmation',
    'holdingStatement': 'Holding Statement',
}

errors_ns = {
    'unknown': 'An unexpected error occurred',
}

# ==== File config ====
FILES_CONFIG = {
    'IPODashboardScreen.test.tsx': ('ipos', ipos, errors_ns),
    'ProfileScreen.test.tsx': ('profile', profile, None),
    'PlaceOrderScreen.test.tsx': ('trading', trading, None),
    'PlaceOrderScreenFrozenFix.test.tsx': ('trading', trading, None),
    'CommunityCoursesScreen.test.tsx': ('education', education, time_translations),
    'MyCoursesScreen.test.tsx': ('education', education, None),
    'CourseDetailScreen.test.tsx': ('education', education, None),
    'LearningPathsScreen.test.tsx': ('education', education, None),
    'ContractNoteUploadScreen.test.tsx': ('reports', reports, None),
    'ReportsScreen.test.tsx': ('reports', reports, None),
}

# ==== The mock header and footer markers ====
MOCK_START_MARKER = 'Mock useT hook'
MOCK_END_LINE = '));'

# ==== Names to remove if duplicated ====
NS_NAMES = {'ipos', 'profile', 'trading', 'education', 'reports', 'time', 'errors'}
FUNC_NAMES = {'resolveT'}

def build_mock_block(ns, data, extra_data):
    """Build clean mock block text."""
    ns_json = json.dumps(data, ensure_ascii=False, indent=2)
    
    extra_decls = ''
    spread_entries = ns
    
    if extra_data:
        extra_name = None
        # Determine the extra variable name
        if extra_data is time_translations:
            extra_name = 'time'
        elif extra_data is errors_ns:
            extra_name = 'errors'
        else:
            extra_name = 'extra'
        
        extra_json = json.dumps(extra_data, ensure_ascii=False, indent=2)
        extra_decls = f'\nconst {extra_name} = {extra_json};'
        spread_entries += f', ...{extra_name}'
    
    resolve_t = f'''
function resolveT(key: string, params?: Record<string, any>): string {{
  const parts = key.split('.');
  const rootNs = parts[0];
  const subKey = parts.slice(1).join('.');
  
  const translations: Record<string, any> = {{ {spread_entries} }};
  const obj = translations[rootNs];
  if (!obj) return key;
  
  // Check for plural variant FIRST when count !== 1
  if (params && params.count !== undefined && params.count !== 1) {{
    const pluralKey = subKey + '_plural';
    if (pluralKey in obj && typeof obj[pluralKey] === 'string') {{
      let result: string = obj[pluralKey];
      result = result.replace(/\\{{(\\w+)\\}}/g, (_: string, p: string) => String(params[p] ?? `{{{{${{p}}}}}}`));
      return result;
    }}
  }}
  
  // Fall back to singular
  if (subKey in obj && typeof obj[subKey] === 'string') {{
    let result: string = obj[subKey];
    if (params) {{
      result = result.replace(/\\{{(\\w+)\\}}/g, (_: string, p: string) => String(params[p] ?? `{{{{${{p}}}}}}`));
    }}
    return result;
  }}
  
  return key;
}}'''
    
    return f'''
// ==================== Mock useT hook ====================
const {ns} = {ns_json};{extra_decls}

{resolve_t}

vi.mock('../hooks/useT', () => ({{
  useT: () => ({{
    t: resolveT,
    language: 'en',
    isHindi: false,
    toggleLanguage: vi.fn(),
  }}),
  default: () => ({{
    t: resolveT,
    language: 'en',
    isHindi: false,
    toggleLanguage: vi.fn(),
  }}),
}}));
'''


def remove_old_mocks(lines):
    """Remove ALL old mock content (const decls, resolveT, vi.mock) from lines list."""
    result = []
    skip_until_marker = False
    
    for line in lines:
        stripped = line.strip()
        
        # If we find the Mock hook marker, start skipping
        if MOCK_START_MARKER in stripped:
            skip_until_marker = True
            continue
        
        # If we were skipping, check if we've reached the end of the mock block
        if skip_until_marker:
            # Check if this line ends the mock block: line containing '));'
            if stripped == MOCK_END_LINE or stripped == '}));':
                skip_until_marker = False
                continue
            # Otherwise skip the line
            continue
        
        # Skip any standalone 'resolveT' function declarations (orphaned)
        if stripped.startswith('function resolveT('):
            # Skip the entire function block
            brace_count = 0
            skip_func = True
            for ch in line:
                if ch == '{': brace_count += 1
                if ch == '}': brace_count -= 1
            continue
        
        # Skip any const declarations for known namespace variables if they're orphaned
        # We'll handle this in a second pass
        
        result.append(line)
    
    return result


def remove_duplicate_consts_and_funcs(lines):
    """Remove duplicate const and function declarations."""
    seen_consts = set()
    seen_funcs = set()
    result = []
    
    for line in lines:
        stripped = line.strip()
        
        # Check for const declarations
        for ns_name in NS_NAMES:
            prefix = f'const {ns_name} ='
            if stripped.startswith(prefix):
                if ns_name in seen_consts:
                    # Duplicate - skip this const block
                    # We need to also skip the object body
                    # Find the end by tracking braces
                    brace_count = 0
                    in_obj = False
                    for ch in line:
                        if ch == '{':
                            brace_count += 1
                            in_obj = True
                    if not in_obj:
                        # One-liner, just skip this line
                        continue
                    else:
                        # Multi-line object - skip until braces balance
                        continue  # Skip this line, the brace counting handles the rest
                else:
                    seen_consts.add(ns_name)
        
        # Check for function declarations
        if stripped.startswith('function resolveT('):
            if 'resolveT' in seen_funcs:
                # Skip duplicate
                continue
            seen_funcs.add('resolveT')
        
        result.append(line)
    
    return result


def patch_file(filepath, ns, data, extra_data):
    """Cleanly patch a single file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We need to handle the fact that the mock block spans multiple lines
    # The approach: find all lines, remove anything between Mock hook marker and the closing }));
    
    # First, let's just directly remove known patterns from the raw content
    # Remove everything between "// ==== Mock useT hook ===" and "}));\n" or "));\n"
    import re
    
    # Pattern 1: Remove entire mock blocks (most aggressive)
    # Match from the mock comment through to the closing "}));" or "));"
    content = re.sub(
        r'// ==================== Mock useT hook ====================\n.*?\n(?:}));|));)\n?',
        '',
        content,
        flags=re.DOTALL
    )
    
    # Pattern 2: Remove any orphaned "const ns_name = {" declarations that remain
    # This handles cases where the first regex didn't match perfectly
    for ns_name in NS_NAMES:
        # Match "const ns_name = {" followed by any content up to "};" 
        # But only if there's another "const ns_name" before it (meaning it's a duplicate)
        # Actually, let's just remove ALL const declarations for these names that come
        # AFTER the first one. This is simpler.
        pass
    
    # Pattern 3: Remove orphaned "function resolveT" blocks (all but last)
    # Count resolveT functions
    resolveT_count = len(re.findall(r'function resolveT\(', content))
    if resolveT_count > 1:
        # Remove all but the last one
        # Find all start positions
        positions = [m.start() for m in re.finditer(r'function resolveT\(', content)]
        # Keep only the last occurrence
        positions_to_remove = positions[:-1]
        for pos in reversed(positions_to_remove):
            # Find the end of this function (by counting braces or finding semicolon/newline)
            # The resolveT function ends with "}" on its own line
            end_pos = content.find('\n}\n', pos)
            if end_pos >= 0:
                content = content[:pos] + content[end_pos+3:]
    
    # Remove duplicate const declarations
    for ns_name in NS_NAMES:
        pattern = rf'const {ns_name} = '
        indices = [m.start() for m in re.finditer(pattern, content)]
        if len(indices) > 1:
            # Remove all but the first occurrence
            # Find the end of each const block
            for idx in reversed(indices[1:]):
                # Find end - look for "};\n" or ";\n" (end of const declaration)
                end_match = re.search(r';\n', content[idx:])
                if end_match:
                    end_pos = idx + end_match.end()
                    content = content[:idx] + content[end_pos:]
    
    # Build and insert the new mock block
    mock_block = build_mock_block(ns, data, extra_data)
    
    # Find first import statement
    lines = content.split('\n')
    insert_idx = -1
    for i, line in enumerate(lines):
        if line.strip().startswith('import ') and '//' not in line[:10]:
            insert_idx = i
            break
    
    if insert_idx < 0:
        print(f'  ERROR: Cannot find import in {filepath}')
        return False
    
    lines.insert(insert_idx, mock_block)
    
    # Clean up excessive blank lines
    result = '\n'.join(lines)
    while '\n\n\n\n' in result:
        result = result.replace('\n\n\n\n', '\n\n\n')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(result)
    
    print(f'  PATCHED: {filepath}')
    return True


def main():
    test_dir = 'src/__tests__'
    patched = 0
    errors = 0
    
    for filename, (ns, data, extra_data) in FILES_CONFIG.items():
        filepath = os.path.join(test_dir, filename)
        if not os.path.exists(filepath):
            print(f'  NOT FOUND: {filepath}')
            errors += 1
            continue
        
        if patch_file(filepath, ns, data, extra_data):
            patched += 1
        else:
            errors += 1
    
    print(f'\nDone: {patched} patched, {errors} errors')


if __name__ == '__main__':
    main()
