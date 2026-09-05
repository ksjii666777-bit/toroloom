# ⚖️ Toroloom — Legal Templates

> **For: legal counsel handling the acquisition.** Each template below is a fill-in-the-blank starter.
> Not a substitute for legal advice — buyer should have their attorney review before signing.

---

## 📄 Template Index

| Template | Purpose | When to Use |
|----------|---------|-------------|
| [1. NDA](#1-non-disclosure-agreement) | Mutual confidentiality before sharing source | Before any code review |
| [2. LOI](#2-letter-of-intent) | Non-binding purchase intent | After NDA + initial review |
| [3. Asset Purchase Agreement Outline](#3-asset-purchase-agreement-outline) | Binding sale contract | After LOI accepted |
| [4. IP Assignment](#4-ip-assignment) | Transfer ownership of code/IP | At closing |
| [5. Transition Services Agreement](#5-transition-services-agreement) | Author continues supporting | Post-closing (optional) |
| [6. Bill of Sale](#6-bill-of-sale) | Final transfer receipt | At closing |

---

## 1. Non-Disclosure Agreement

**Parties:** [Seller] ("Disclosing Party") and [Buyer] ("Receiving Party")
**Effective Date:** [DATE]

### 1.1 Confidential Information
All information disclosed by Disclosing Party relating to the Toroloom mobile application and backend, including but not limited to: source code, architecture diagrams, test results, business plans, customer data, financial information, and any materials marked "Confidential."

### 1.2 Obligations
Receiving Party agrees to:
- Use Confidential Information solely for evaluation of a potential acquisition
- Not disclose to third parties without prior written consent
- Protect with same degree of care as own confidential information (no less than reasonable care)
- Limit access to employees, advisors, and contractors with need-to-know

### 1.3 Exclusions
Confidential Information does not include information that:
- Is or becomes publicly available without breach of this Agreement
- Was rightfully in Receiving Party's possession prior to disclosure
- Is independently developed without reference to Confidential Information
- Is required to be disclosed by law (with prompt notice to Disclosing Party)

### 1.4 Term
This Agreement remains in effect for **[2/3/5]** years from the Effective Date.

### 1.5 Governing Law
[State/Country]

### Signatures

**Disclosing Party:** _________________________ Date: __________

**Receiving Party:** _________________________ Date: __________

---

## 2. Letter of Intent

**Date:** [DATE]
**From:** [Buyer]
**To:** [Seller]

Dear [Seller Name],

This Letter of Intent ("LOI") sets forth the principal terms under which [Buyer] ("Buyer") proposes to acquire the Toroloom platform from [Seller] ("Seller").

### 2.1 Proposed Transaction
**Structure:** Asset purchase (source code, IP, customer contracts, infrastructure)

**Purchase Price:** $[AMOUNT] USD, payable as:
- $[X] at closing (wire transfer / escrow)
- $[Y] deferred over [N] months (earn-out)
- $[Z] in equity (if applicable)

### 2.2 Closing Conditions
- Successful technical due diligence (code review, security audit, test run)
- Transfer of all IP, source code, infrastructure credentials
- No material adverse change in code quality / test pass rate from current state
- Non-compete / non-solicitation agreement from key personnel

### 2.3 Exclusivity
Seller agrees not to solicit alternative offers for **[30/45/60]** days from execution of this LOI.

### 2.4 Binding Effect
This LOI is **non-binding** except for the Exclusivity and Confidentiality provisions, which are binding.

### 2.5 Next Steps
- Buyer conducts technical due diligence (1-2 weeks)
- Negotiation of definitive Asset Purchase Agreement (1-2 weeks)
- Closing within [30/45/60] days of signed APA

Sincerely,

[Buyer Name & Title]

**Acknowledged by Seller:** _________________________ Date: __________

---

## 3. Asset Purchase Agreement Outline

**Parties:** [Seller] ("Seller") and [Buyer] ("Buyer")
**Closing Date:** [DATE]

### 3.1 Purchase and Sale of Assets
Seller sells, transfers, assigns, conveys, and delivers to Buyer all right, title, and interest in and to the following assets (the "Acquired Assets"):

**A. Intellectual Property**
- All source code (mobile app, backend, infrastructure scripts)
- All documentation, guides, runbooks
- All trademarks, logos, brand assets (if any)
- All patent applications and issued patents (if any)
- All domain names and social media accounts

**B. Customer Contracts and Data**
- All customer data (subject to privacy policy / GDPR)
- All user accounts and authentication systems
- All vendor/supplier contracts (transferable)

**C. Infrastructure**
- Cloud accounts (Railway, AWS, GCP, Azure)
- Database contents and credentials
- DNS records and SSL certificates
- Third-party API keys and service accounts

**D. Tangible Property**
- Hardware (if any)
- Office equipment (if any)

### 3.2 Purchase Price
$[AMOUNT] USD, payable as specified in LOI Section 2.1.

### 3.3 Representations and Warranties of Seller
- Seller has full right and authority to transfer the Acquired Assets
- Source code is original work of Seller or properly licensed from third parties
- No third-party IP infringement claims known
- All open-source dependencies are properly attributed and license-compliant (see LICENSE + third-party notices)
- No material bugs known beyond those documented in issue tracker
- All financial information is accurate

### 3.4 Representations and Warranties of Buyer
- Buyer has full corporate authority to enter this Agreement
- Funds available for purchase price

### 3.5 Indemnification
- Seller indemnifies Buyer against pre-closing liabilities and IP infringement claims
- Buyer indemnifies Seller against post-closing liabilities and Buyer's use of assets
- Cap: $[X] USD / [N] months post-closing

### 3.6 Conditions to Closing
- Completion of technical due diligence
- All regulatory approvals obtained (if applicable)
- No material adverse change
- Delivery of all assets, credentials, IP assignments

### 3.7 Governing Law
[State/Country]

---

## 4. IP Assignment

**Assignor:** [Seller]
**Assignee:** [Buyer]
**Effective Date:** [DATE]

Assignor hereby irrevocably assigns, transfers, and conveys to Assignee all right, title, and interest in and to the Intellectual Property listed below:

### 4.1 IP Being Assigned
- All source code in the Toroloom project (mobile app + backend)
- All commit history in the git repository [GitHub URL]
- All documentation, design assets, and configuration files
- All related trademarks, service marks, and trade names
- All copyrights, patents (pending or issued), trade secrets

### 4.2 Reservation
None — full assignment.

### 4.3 Further Assurances
Assignor agrees to execute any additional documents reasonably necessary to perfect Assignee's ownership.

### 4.4 Warranty
Assignor warrants that:
- All IP is original or properly licensed
- No co-inventors or co-authors exist beyond those listed below
- No encumbrances, liens, or third-party claims

### 4.5 Personnel IP
All developers who contributed to the codebase have signed IP assignment agreements with Assignor (or are employees under work-made-for-hire).

### Signatures

**Assignor:** _________________________ Date: __________

**Assignee:** _________________________ Date: __________

**Witness:** _________________________ Date: __________

---

## 5. Transition Services Agreement

**Parties:** [Seller] ("Consultant") and [Buyer] ("Company")
**Effective Date:** [Closing Date]
**Term:** [N] months post-closing

### 5.1 Services
Consultant agrees to provide transition services to Company, including but not limited to:
- Technical Q&A and code walkthroughs (up to [N] hours/month)
- Bug investigation and triage
- Deployment support during handover
- Introduction to vendors and service providers
- Knowledge transfer sessions with Company engineering team

### 5.2 Compensation
- $[X] USD per month retainer
- $[Y] USD per hour for additional services beyond retainer (pre-approved)
- Reimbursement of pre-approved expenses

### 5.3 Independent Contractor
Consultant is an independent contractor, not an employee. No benefits, no tax withholding.

### 5.4 Confidentiality
Consultant continues to be bound by NDA terms regarding any new confidential information shared by Company.

### 5.5 Termination
Either party may terminate with [30/60] days written notice. Upon termination, all Confidential Information returned.

### 5.6 Non-Compete (Optional)
For [N] months post-termination, Consultant agrees not to develop a competing trading platform directly targeting the same customer segment.

### Signatures

**Consultant:** _________________________ Date: __________

**Company:** _________________________ Date: __________

---

## 6. Bill of Sale

**Date:** [Closing Date]
**Seller:** [Seller]
**Buyer:** [Buyer]

Seller hereby sells, transfers, assigns, conveys, and delivers to Buyer all right, title, and interest in and to the Acquired Assets (as defined in the Asset Purchase Agreement dated [DATE]).

### 6.1 Acknowledgment
Buyer acknowledges receipt of all Acquired Assets and accepts them in their current "AS-IS" condition, subject to the representations and warranties in the Asset Purchase Agreement.

### 6.2 Delivery
- Source code: transferred via [GitHub transfer / GitLab export / USB drive / other]
- Infrastructure credentials: delivered via [1Password / encrypted archive / other]
- Documentation: located at [URL or list of files]
- Domain names: transferred via registrar [Namecheap / GoDaddy / other]

### Signatures

**Seller:** _________________________ Date: __________

**Buyer:** _________________________ Date: __________

**Notary (if required):** _________________________ Date: __________

---

## 📞 Notes for Legal Counsel

1. **Jurisdiction:** Indian law likely most familiar for Toroloom (origin + primary market). Cross-border sale may need additional considerations.

2. **Open-source compliance:** Toroloom uses MIT/Apache/BSD dependencies. No GPL contamination. Third-party notices file recommended for delivery.

3. **Privacy law:** User data subject to DPDP Act (India) + GDPR (if EU users). Buyer must inherit Privacy Policy + ToS or replace.

5. **SEBI considerations:** If Toroloom includes SEBI RA (investment advisor) registration, separate assignment and notification required.

6. **Tax:** Capital gains / GST implications. Recommend tax counsel review.

7. **Insurance:** Cyber liability / E&O insurance recommended for both parties during transition.

---

> ⚠️ **DISCLAIMER:** These templates are **starting points only**. Buyer and Seller should engage qualified legal counsel in their respective jurisdictions before signing any binding agreement.