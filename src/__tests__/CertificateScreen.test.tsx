/**
 * ============================================================================
 * Toroloom — CertificateScreen Integration Tests
 * ============================================================================
 *
 * Covers: empty state, eligible courses, certificate list with grade/serial/stats,
 * certificate preview mode, PDF generation & sharing, generating overlay,
 * auto-generate via route params.
 */

import React, { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from './testUtils';

// ==================== Mocks (all consts BEFORE vi.mock) ====================

const mockNavigate = vi.fn();
const mockGoBack = vi.fn();
const mockGenerateCertificate = vi.fn();

// Mutable store state
var mockCertificates: any[] = [];
var mockCourses: any[] = [];
var mockIsGenerating = false;
var mockAlertCalls: any[] = [];

// Exposed share mock — set by react-native factory during import resolution
// IMPORTANT: no '= null' init, or it will overwrite the factory's value!
var exposedShare: any;

// ==================== vi.mock Factories ====================

vi.mock('../context/ThemeContext', () => ({
  useTheme: function() {
    return {
      colors: {
        primary: '#6C63FF', primaryLight: '#8B83FF', primaryDark: '#4A42CC',
        primaryGradient: ['#6C63FF', '#4834D4'],
        secondary: '#FF6B6B', success: '#00C853', danger: '#FF1744', warning: '#FFC107',
        accent: '#FF6B9D', marketUp: '#00C853', marketDown: '#FF1744', marketNeutral: '#FFC107',
        text: '#FFFFFF', textSecondary: '#B0B0D0', textMuted: '#6E6E9A',
        white: '#FFFFFF', bg: '#0D0D2B', bgSecondary: '#1A1A3E', bgCard: '#222255',
        bgCardLight: '#2A2A5E', bgInput: '#1E1E4A', bgDark: '#070720',
        bgOverlay: 'rgba(0,0,0,0.5)', border: '#2A2A5E', borderLight: '#3A3A7E',
        divider: '#1E1E4A', transparent: 'transparent',
        background: '#0D0D2B', card: '#222255', notification: '#FF6B6B',
      },
      isDark: true,
    };
  },
}));

vi.mock('../store/educationStore', function() {
  var fn = vi.fn(function(selector) {
    var state = {
      certificates: mockCertificates,
      courses: mockCourses,
      isGeneratingCertificate: mockIsGenerating,
      generateCertificate: mockGenerateCertificate,
      isCourseComplete: function(courseId: string) {
        for (var i = 0; i < mockCourses.length; i++) {
          if (mockCourses[i].id === courseId && mockCourses[i].progress === 100) return true;
        }
        return false;
      },
      fetchLesson: vi.fn(),
      markLessonComplete: vi.fn(),
      lessonProgress: {},
      videoProgress: {},
      videoBookmarks: {},
    };
    return selector ? selector(state) : state;
  });
  (fn as any).getState = function() {
    return {
      isCourseComplete: function(courseId: string) {
        for (var i = 0; i < mockCourses.length; i++) {
          if (mockCourses[i].id === courseId && mockCourses[i].progress === 100) return true;
        }
        return false;
      },
    };
  };
  return { useEducationStore: fn as any };
});

vi.mock('../store/authStore', () => ({
  useAuthStore: vi.fn(function(selector) {
    var state = { user: { name: 'Test Student' } };
    return selector ? selector(state) : state;
  }),
}));

vi.mock('../hooks/useT', () => ({
  useT: function() {
    var translations: Record<string, string> = {
      'education.certificatesTitle': 'Certificates',
      'education.certificate': 'Certificate',
      'education.noCertificatesYet': 'No certificates yet',
      'education.noCertificatesDesc': 'Complete a course to earn your first certificate',
      'education.coursesReady': 'Courses Ready for Certificate',
      'education.browseCourses': 'Browse Courses',
      'education.yourCertificates': 'Your Certificates',
      'education.coursesCompleted': '{count} course completed',
      'education.coursesCompleted_plural': '{count} courses completed',
      'education.learningStats': 'Learning Stats',
      'education.lessonsDone': 'Lessons Done',
      'education.distinctions': 'Distinctions',
      'education.gradeDistinction': 'Distinction',
      'education.gradeMerit': 'Merit',
      'education.completed': 'Completed',
      'education.certGenerated': 'Certificate Generated!',
      'education.certGeneratedMsg': 'Certificate for {name} is ready!',
      'education.certError': 'Error',
      'education.certGenerateError': 'Failed to generate certificate',
      'education.pdfError': 'PDF generation failed',
      'education.generatingCertificate': 'Generating your certificate...',
      'education.ofCompletion': 'Of Completion',
      'education.thisCertifies': 'This certifies that',
      'education.hasCompleted': 'has successfully completed',
      'education.withDistinction': 'With Distinction',
      'education.withMerit': 'With Merit',
      'education.lessonsStat': 'Lessons',
      'education.issuedOn': 'Issued On',
      'education.quizScore': 'Quiz Score',
      'education.serialN': 'Serial No: {num}',
      'education.footerText': 'Verified by Toroloom',
      'education.pdfGenerated': 'PDF generated successfully',
      'education.pdfNotGenerated': 'PDF not yet generated',
      'education.sharePdf': 'Share PDF',
      'education.generateSharePdf': 'Generate & Share PDF',
      'education.openPdf': 'Open PDF',
      'education.view': 'View',
    };
    return {
      t: function(key: string, params: Record<string, string>) {
        if (params) {
          var r = translations[key] || key;
          Object.keys(params).forEach(function(k) { r = r.replace('{' + k + '}', String(params[k])); });
          return r;
        }
        return translations[key] || key;
      },
    };
  },
}));

vi.mock('../utils/formatters', () => ({
  formatDate: function() { return 'Jan 15, 2026'; },
}));

vi.mock('../utils/certificateGenerator', () => ({
  generateCertificatePDF: function() { return Promise.resolve('file://generated-cert.pdf'); },
  generateSerialNumber: function() { return 'SN-TEST-001'; },
  calculateGrade: function() { return 'A'; },
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: function() { return { top: 44, bottom: 34, left: 0, right: 0 }; },
}));

vi.mock('expo-linear-gradient', () => ({    LinearGradient: function(props: any) {
    return React.createElement('View', { style: [{ backgroundColor: '#6C63FF' }, props.style] }, props.children);
  },
}));

vi.mock('react-native-reanimated', () => ({
  default: { View: 'AnimView', Text: 'AnimText', createAnimatedComponent: function(c: any) { return c; } },
  useSharedValue: function() { return { value: 0 }; },
  useAnimatedStyle: function() { return {}; },
  withSpring: function(v: any) { return v; },
  withTiming: function(v: any) { return v; },
  interpolate: function() { return 0; },
  FadeInDown: { delay: function() { return { springify: function() { return {}; } }; } },
  Layout: { springify: function() { return {}; } },
  View: 'AnimView',
  Text: 'AnimText',
  createAnimatedComponent: function(c: any) { return c; },
}));

vi.mock('@react-navigation/native', () => ({
  useNavigation: function() { return { navigate: mockNavigate, goBack: mockGoBack }; },
}));

// Mock react-native — provide all needed exports, override Share and Alert
vi.mock('react-native', function() {
  var shareImpl = { share: vi.fn().mockResolvedValue({ action: 'sharedAction' }) };
  exposedShare = shareImpl;
  return {
    View: 'View', Text: 'Text', ScrollView: 'Scroll', TouchableOpacity: 'Touchable',
    StyleSheet: { create: function(s: any) { return s; } },
    ActivityIndicator: 'ActivityIndicator',
    Dimensions: { get: function() { return { width: 390, height: 844 }; } },
    Platform: { OS: 'ios', select: function(obj: any) { return obj.ios; } },
    Linking: { openURL: function() { return Promise.resolve(); } },
    Share: shareImpl,
    Alert: { alert: function(title: string, msg: string, buttons: any) { mockAlertCalls.push({ title: title, msg: msg, buttons: buttons }); } },
    Animated: { View: 'AnimView', Text: 'AnimText', createAnimatedComponent: function(c: any) { return c; } },
    Pressable: 'Pressable',
    Modal: 'Modal',
    Keyboard: 'Keyboard',
    NativeModules: {},
    NativeEventEmitter: function() { return { addListener: function() {}, remove: function() {} }; },
  };
});

// ==================== Imports ====================

import CertificateScreen from '../screens/education/CertificateScreen';

// ==================== Mock Data ====================

var mockCertA = {
  id: 'cert_1', courseId: 'c1', courseTitle: 'Stock Market Basics',
  userName: 'Test Student', completedLessons: 8, totalLessons: 8,
  grade: 'A', quizScore: 95, quizPercent: 95,
  issuedAt: '2026-01-15T00:00:00.000Z', serialNumber: 'SN-001',
  pdfUri: 'file://cert-1.pdf',
};

var mockCertB = {
  id: 'cert_2', courseId: 'c2', courseTitle: 'Technical Analysis Mastery',
  userName: 'Test Student', completedLessons: 8, totalLessons: 8,
  grade: 'B', quizScore: 82, quizPercent: 82,
  issuedAt: '2026-02-01T00:00:00.000Z', serialNumber: 'SN-002',
  pdfUri: undefined,
};

var mockCourseComplete = {
  id: 'c3', title: 'Mutual Funds & SIP', description: 'Master mutual fund investing.',
  thumbnail: '💰', duration: '4 hours', lessons: 6, progress: 100,
  level: 'beginner', category: 'Funds', rating: 4.6, enrolledCount: 100,
};

var mockCourseIncomplete = {
  id: 'c4', title: 'Advanced Trading', description: 'Learn advanced trading.',
  thumbnail: '📊', duration: '3 hours', lessons: 5, progress: 30,
  level: 'advanced', category: 'Trading', rating: 4.5, enrolledCount: 50,
};

// ==================== Tests ====================

describe('CertificateScreen — Empty State', function() {
  beforeEach(function() {
    vi.useFakeTimers();
    mockCertificates = [];
    mockCourses = [];
    mockIsGenerating = false;
    mockAlertCalls = [];
    mockGenerateCertificate.mockReset();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    if (exposedShare) exposedShare.share.mockClear();
  });

  afterEach(function() {
    vi.useRealTimers();
  });

  it('renders without crashing', function() {
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.toJSON()).not.toBeNull();
  });

  it('renders the certificates title in header', function() {
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Certificates')).toBeDefined();
  });

  it('renders empty state when no certificates exist', function() {
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('No certificates yet')).toBeDefined();
    expect(result.getByText(/Complete all lessons/i)).toBeDefined();
  });

  it('renders Browse Courses button in empty state', function() {
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Browse Courses')).toBeDefined();
  });

  it('navigates to Learn when Browse Courses is pressed', function() {
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    act(function() { fireEvent.press(result.getByText('Browse Courses')); });
    expect(mockNavigate).toHaveBeenCalledWith('Learn');
  });
});

describe('CertificateScreen — Eligible Courses in Empty State', function() {
  beforeEach(function() {
    vi.useFakeTimers();
    mockCertificates = [];
    mockCourses = [mockCourseIncomplete, mockCourseComplete];
    mockIsGenerating = false;
    mockAlertCalls = [];
    mockGenerateCertificate.mockReset();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    if (exposedShare) exposedShare.share.mockClear();
  });

  afterEach(function() {
    vi.useRealTimers();
  });

  it('shows eligible section when completed courses without cert exist', function() {
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Courses Ready for Certificate')).toBeDefined();
  });

  it('shows eligible course title', function() {
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Mutual Funds & SIP')).toBeDefined();
  });

  it('shows eligible course metadata', function() {
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText(/6 lessons/)).toBeDefined();
    expect(result.getByText(/4 hours/)).toBeDefined();
  });

  it('generates certificate when eligible course is tapped', function() {
    mockGenerateCertificate.mockResolvedValue({
      id: 'cert_new', courseId: 'c3', courseTitle: 'Mutual Funds & SIP',
      userName: 'Test Student', completedLessons: 6, totalLessons: 6,
      grade: 'A', issuedAt: '2026-03-01T00:00:00.000Z', serialNumber: 'SN-003', pdfUri: undefined,
    });
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    act(function() { fireEvent.press(result.getByText('Mutual Funds & SIP')); });
    expect(mockGenerateCertificate).toHaveBeenCalledWith('c3');
  });

  it('hides eligible section when completed course already has a certificate', function() {
    mockCertificates = [{ ...mockCertA, courseId: 'c3' }];
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    // Has 1 cert, so renders list view, not empty state
    expect(result.getByText('Your Certificates')).toBeDefined();
    // Eligible section should NOT appear (only completed course already has cert)
    expect(function() { result.getByText('Courses Ready for Certificate'); }).toThrow();
  });

  it('shows error alert when generate returns null', async function() {
    mockGenerateCertificate.mockResolvedValue(null);
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    act(function() { fireEvent.press(result.getByText('Mutual Funds & SIP')); });
    // Wait for the async handleGenerate to complete
    await act(async function() { await Promise.resolve(); });
    expect(mockGenerateCertificate).toHaveBeenCalledWith('c3');
    expect(mockAlertCalls.length).toBeGreaterThan(0);
    expect(mockAlertCalls[0].title).toBe('Error');
  });
});

describe('CertificateScreen — Certificate List', function() {
  beforeEach(function() {
    vi.useFakeTimers();
    mockCertificates = [mockCertA, mockCertB];
    mockCourses = [mockCourseComplete, mockCourseIncomplete];
    mockIsGenerating = false;
    mockAlertCalls = [];
    mockGenerateCertificate.mockReset();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    if (exposedShare) exposedShare.share.mockClear();
  });

  afterEach(function() {
    vi.useRealTimers();
  });

  it('renders Your Certificates section title', function() {
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Your Certificates')).toBeDefined();
  });

  it('renders certificate course titles', function() {
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Stock Market Basics')).toBeDefined();
    expect(result.getByText('Technical Analysis Mastery')).toBeDefined();
  });

  it('renders grade badges', function() {
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Distinction')).toBeDefined();
    expect(result.getByText('Merit')).toBeDefined();
  });

  it('renders serial numbers for each certificate', function() {
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('#SN-001')).toBeDefined();
    expect(result.getByText('#SN-002')).toBeDefined();
  });

  it('renders lesson completion stats', function() {
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('8/8 lessons')).toBeDefined();
  });

  it('renders quiz percentages', function() {
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Quiz: 95%')).toBeDefined();
    expect(result.getByText('Quiz: 82%')).toBeDefined();
  });

  it('renders certificate dates', function() {
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    var dates = result.getAllByText('Jan 15, 2026');
    expect(dates.length).toBeGreaterThan(0);
  });

  it('renders Learning Stats card', function() {
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Learning Stats')).toBeDefined();
    expect(result.getByText('Certificates')).toBeDefined();
    expect(result.getByText('Lessons Done')).toBeDefined();
    expect(result.getByText('Distinctions')).toBeDefined();
  });

  it('renders header count badge', function() {
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('2')).toBeDefined();
  });

  it('opens certificate preview when a card is pressed', function() {
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    act(function() { fireEvent.press(result.getByText('Stock Market Basics')); });
    // Preview should show the certificate header
    expect(result.getByText('Certificate')).toBeDefined();
    expect(result.getByText('OF COMPLETION')).toBeDefined();
  });
});

describe('CertificateScreen — Certificate Preview', function() {
  beforeEach(function() {
    vi.useFakeTimers();
    mockCertificates = [mockCertA];
    mockCourses = [mockCourseComplete];
    mockIsGenerating = false;
    mockAlertCalls = [];
    mockGenerateCertificate.mockReset();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    if (exposedShare) exposedShare.share.mockClear();
  });

  afterEach(function() {
    vi.useRealTimers();
  });

  it('shows recipient name in preview', function() {
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    act(function() { fireEvent.press(result.getByText('Stock Market Basics')); });
    expect(result.getByText('Test Student')).toBeDefined();
  });

  it('shows course title in preview', function() {
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    act(function() { fireEvent.press(result.getByText('Stock Market Basics')); });
    expect(result.getByText('Stock Market Basics')).toBeDefined();
  });

  it('shows With Distinction grade badge for grade A', function() {
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    act(function() { fireEvent.press(result.getByText('Stock Market Basics')); });
    expect(result.getByText('With Distinction')).toBeDefined();
  });

  it('shows With Merit grade badge for grade B', function() {
    mockCertificates = [mockCertB];
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    act(function() { fireEvent.press(result.getByText('Technical Analysis Mastery')); });
    expect(result.getByText('With Merit')).toBeDefined();
  });

  it('shows lesson stats in preview', function() {
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    act(function() { fireEvent.press(result.getByText('Stock Market Basics')); });
    expect(result.getByText('8/8')).toBeDefined();
    expect(result.getByText('Lessons')).toBeDefined();
    expect(result.getByText('Issued On')).toBeDefined();
  });

  it('shows quiz score in preview', function() {
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    act(function() { fireEvent.press(result.getByText('Stock Market Basics')); });
    expect(result.getByText('95%')).toBeDefined();
    expect(result.getByText('Quiz Score')).toBeDefined();
  });

  it('shows serial number in preview', function() {
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    act(function() { fireEvent.press(result.getByText('Stock Market Basics')); });
    expect(result.getByText('Serial No: SN-001')).toBeDefined();
  });
});

describe('CertificateScreen — PDF Status & Sharing', function() {
  beforeEach(function() {
    vi.useFakeTimers();
    mockCertificates = [mockCertA, mockCertB];
    mockCourses = [mockCourseComplete];
    mockIsGenerating = false;
    mockAlertCalls = [];
    mockGenerateCertificate.mockReset();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
    if (exposedShare) exposedShare.share.mockClear();
  });

  afterEach(function() {
    vi.useRealTimers();
  });

  it('shows PDF generated status when pdfUri exists', function() {
    mockCertificates = [mockCertA];
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    act(function() { fireEvent.press(result.getByText('Stock Market Basics')); });
    expect(result.getByText('PDF generated successfully')).toBeDefined();
  });

  it('shows PDF not generated status when no pdfUri', function() {
    mockCertificates = [mockCertB];
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    act(function() { fireEvent.press(result.getByText('Technical Analysis Mastery')); });
    expect(result.getByText('PDF not yet generated')).toBeDefined();
  });

  it('shows Share PDF text when pdfUri exists', function() {
    mockCertificates = [mockCertA];
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    act(function() { fireEvent.press(result.getByText('Stock Market Basics')); });
    expect(result.getByText('Share PDF')).toBeDefined();
  });

  it('shows Generate & Share PDF text when pdfUri is empty', function() {
    mockCertificates = [mockCertB];
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    act(function() { fireEvent.press(result.getByText('Technical Analysis Mastery')); });
    expect(result.getByText('Generate & Share PDF')).toBeDefined();
  });

  it('calls Share.share when Share PDF is pressed (pdfUri exists)', async function() {
    mockCertificates = [mockCertA];
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    act(function() { fireEvent.press(result.getByText('Stock Market Basics')); });
    act(function() { fireEvent.press(result.getByText('Share PDF')); });
    // handleSharePDF is async; flush microtasks
    await act(async function() { await Promise.resolve(); });
    expect(exposedShare.share).toHaveBeenCalled();
  });

  it('includes course title and serial in share content', async function() {
    mockCertificates = [mockCertA];
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    act(function() { fireEvent.press(result.getByText('Stock Market Basics')); });
    act(function() { fireEvent.press(result.getByText('Share PDF')); });
    await act(async function() { await Promise.resolve(); });
    expect(exposedShare.share).toHaveBeenCalledWith({
      title: expect.stringContaining('Stock Market Basics'),
      message: expect.stringContaining('SN-001'),
      url: 'file://cert-1.pdf',
    });
  });
});

describe('CertificateScreen — Generating Overlay', function() {
  beforeEach(function() {
    vi.useFakeTimers();
    mockCertificates = [];
    mockCourses = [mockCourseComplete];
    mockIsGenerating = true;
    mockAlertCalls = [];
    mockGenerateCertificate.mockReset();
    mockNavigate.mockClear();
    mockGoBack.mockClear();
  });

  afterEach(function() {
    vi.useRealTimers();
  });

  it('shows generating overlay when isGeneratingCertificate is true', function() {
    var result = render(
      <CertificateScreen route={{ params: {} }} navigation={{ navigate: mockNavigate, goBack: mockGoBack }} />
    );
    expect(result.getByText('Generating your certificate...')).toBeDefined();
  });
});

describe('CertificateScreen — Auto-generate via Route Params', function() {
  beforeEach(function() {
    vi.useFakeTimers();
    mockCertificates = [];
    mockCourses = [mockCourseComplete];
    mockIsGenerating = false;
    mockAlertCalls = [];
    mockGenerateCertificate.mockReset();
    mockGenerateCertificate.mockResolvedValue({
      id: 'cert_auto', courseId: 'c3', courseTitle: 'Mutual Funds & SIP',
      userName: 'Test Student', completedLessons: 6, totalLessons: 6,
      grade: 'A', issuedAt: new Date().toISOString(), serialNumber: 'SN-AUTO',
    });
    mockNavigate.mockClear();
    mockGoBack.mockClear();
  });

  afterEach(function() {
    vi.useRealTimers();
  });

  it('auto-generates when courseId is passed and no cert exists for it', function() {
    render(
      <CertificateScreen
        route={{ params: { courseId: 'c3' } }}
        navigation={{ navigate: mockNavigate, goBack: mockGoBack }}
      />
    );
    expect(mockGenerateCertificate).toHaveBeenCalledWith('c3');
  });

  it('does NOT auto-generate when cert already exists for that course', function() {
    mockCertificates = [mockCertA];
    render(
      <CertificateScreen
        route={{ params: { courseId: 'c1' } }}
        navigation={{ navigate: mockNavigate, goBack: mockGoBack }}
      />
    );
    expect(mockGenerateCertificate).not.toHaveBeenCalled();
  });

  it('does not auto-generate when no courseId in params', function() {
    render(
      <CertificateScreen
        route={{ params: {} }}
        navigation={{ navigate: mockNavigate, goBack: mockGoBack }}
      />
    );
    expect(mockGenerateCertificate).not.toHaveBeenCalled();
  });
});
