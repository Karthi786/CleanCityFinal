import { reviewsAPI } from './api.js';

const DEPT_LABELS = {
    TAMILNADU_CORPORATION: 'Tamilnadu Corporation',
    TNEB: 'TNEB (Electrical)',
    POLICE: 'Tamilnadu Police',
    FIRE_STATION: 'Fire & Rescue Services',
};

/**
 * Generates and downloads a print-formatted PDF of a single issue
 * Styled as an official Government of Tamil Nadu Complaint Report
 */
export async function downloadSingleIssuePDF(issue) {
    const now = new Date();
    const currentUser = JSON.parse(localStorage.getItem('cm_user') || '{}');

    // Fetch review/feedback comments if available
    let review = null;
    try {
        const res = await reviewsAPI.getByIssue(issue.id);
        if (res && res.reviews && res.reviews.length > 0) {
            review = res.reviews[0];
        }
    } catch (e) {
        console.error('Failed to load reviews for PDF:', e);
    }

    const createdDate = new Date(issue.created_at).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
    
    const updatedDate = issue.updated_at ? new Date(issue.updated_at).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    }) : 'N/A';

    const cleanDescription = issue.description ? issue.description.replace('[privacy:hide_name]', '').trim() : '';

    const printWin = window.open('', '_blank');
    printWin.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Official Report — Issue #${issue.id.slice(0, 8)}</title>
    <style>
        body {
            font-family: 'Georgia', 'Times New Roman', serif;
            margin: 40px;
            color: #1e293b;
            line-height: 1.5;
            background: #fff;
        }
        
        .gov-header {
            text-align: center;
            border-bottom: 3px double #b00000;
            padding-bottom: 15px;
            margin-bottom: 24px;
        }

        .gov-header h1 {
            font-family: 'Arial', sans-serif;
            font-size: 1.6rem;
            color: #b00000;
            font-weight: 800;
            margin: 4px 0;
            letter-spacing: 0.05em;
        }

        .gov-header h2 {
            font-family: 'Arial', sans-serif;
            font-size: 1.05rem;
            color: #475569;
            font-weight: 600;
            margin: 2px 0 10px 0;
            letter-spacing: 0.1em;
            text-transform: uppercase;
        }

        .gov-emblem {
            font-size: 2.5rem;
            margin-bottom: 6px;
        }

        .meta-stamp {
            font-family: 'Courier New', monospace;
            font-size: 0.78rem;
            color: #64748b;
            text-align: right;
            margin-bottom: 20px;
        }

        .section-title {
            font-family: 'Arial', sans-serif;
            font-size: 1.1rem;
            color: #0f172a;
            font-weight: 800;
            text-transform: uppercase;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 4px;
            margin-top: 24px;
            margin-bottom: 12px;
            letter-spacing: 0.02em;
        }

        .grid-info {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 16px;
            font-size: 0.88rem;
        }

        .info-cell {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px 12px;
        }

        .info-cell.full-width {
            grid-column: 1 / -1;
        }

        .info-label {
            font-family: 'Arial', sans-serif;
            font-size: 0.72rem;
            font-weight: 800;
            text-transform: uppercase;
            color: #64748b;
            margin-bottom: 2px;
            letter-spacing: 0.05em;
        }

        .info-val {
            font-weight: 700;
            color: #0f172a;
        }

        .description-box {
            font-family: 'Georgia', serif;
            font-size: 0.95rem;
            line-height: 1.6;
            color: #334155;
            background: #fdfdfd;
            border-left: 3px solid #cbd5e1;
            padding: 10px 16px;
            margin-top: 4px;
            border-radius: 0 6px 6px 0;
            white-space: pre-wrap;
        }

        /* Badge status colors */
        .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 800;
            font-family: 'Arial', sans-serif;
            text-transform: uppercase;
        }
        
        .badge-PENDING { background: #fee2e2; color: #b91c1c; }
        .badge-IN_PROGRESS { background: #dbeafe; color: #1d4ed8; }
        .badge-COMPLETED { background: #dcfce7; color: #15803d; }

        /* Images evidence */
        .evidence-container {
            display: grid;
            grid-template-columns: 1fr;
            gap: 20px;
            margin-top: 10px;
        }

        @media (min-width: 600px) {
            .evidence-container {
                grid-template-columns: 1fr 1fr;
            }
        }

        .evidence-card {
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            overflow: hidden;
            background: #f8fafc;
            text-align: center;
        }

        .evidence-img-label {
            background: #f1f5f9;
            padding: 8px;
            font-family: 'Arial', sans-serif;
            font-size: 0.8rem;
            font-weight: 700;
            color: #475569;
            border-bottom: 1px solid #e2e8f0;
            text-transform: uppercase;
        }

        .evidence-img {
            max-width: 100%;
            height: 200px;
            object-fit: contain;
            background: #f1f5f9;
            display: block;
            margin: 0 auto;
        }

        /* Timeline styling */
        .timeline {
            display: flex;
            flex-direction: column;
            gap: 12px;
            margin-left: 10px;
            margin-top: 10px;
        }

        .timeline-item {
            display: flex;
            gap: 14px;
            align-items: flex-start;
            position: relative;
        }

        .timeline-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #cbd5e1;
            margin-top: 6px;
            flex-shrink: 0;
        }

        .timeline-dot.active {
            background: #b00000;
            box-shadow: 0 0 0 3px rgba(176, 0, 0, 0.2);
        }

        .timeline-content {
            font-size: 0.88rem;
        }

        .timeline-title {
            font-weight: 700;
            color: #0f172a;
        }

        .timeline-time {
            font-size: 0.78rem;
            color: #64748b;
        }

        /* Footer */
        .gov-footer {
            margin-top: 50px;
            border-top: 1px solid #e2e8f0;
            padding-top: 12px;
            text-align: center;
            font-family: 'Arial', sans-serif;
            font-size: 0.72rem;
            color: #94a3b8;
            letter-spacing: 0.05em;
        }

        @media print {
            body {
                margin: 20px;
            }
            .no-print {
                display: none;
            }
            a {
                text-decoration: none;
                color: #000;
            }
            .info-cell {
                background: #fff !important;
                border: 1px solid #cbd5e1;
            }
            .evidence-img-label {
                background: #f1f5f9 !important;
            }
        }
    </style>
</head>
<body>

    <div class="gov-header">
        <div class="gov-emblem">🏛️</div>
        <h1>GOVERNMENT OF TAMIL NADU</h1>
        <h2>CIVIC COMPLAINT RESOLUTION REPORT</h2>
    </div>

    <div class="meta-stamp">
        REPORT ID: TN-MC-${issue.id.slice(0, 8).toUpperCase()}<br>
        GENERATED ON: ${now.toLocaleString('en-IN')}<br>
        PRINTED BY: ${currentUser.name || 'N/A'} (${currentUser.role || 'Authority'})
    </div>

    <div class="section-title">Grievance Summary</div>
    <div class="grid-info">
        <div class="info-cell">
            <div class="info-label">Issue ID</div>
            <div class="info-val">${issue.id}</div>
        </div>
        <div class="info-cell">
            <div class="info-label">Current Status</div>
            <div class="info-val">
                <span class="badge badge-${issue.status}">${issue.status === 'COMPLETED' ? 'Resolved / Done' : issue.status === 'IN_PROGRESS' ? 'Processing' : 'Pending'}</span>
            </div>
        </div>
        <div class="info-cell">
            <div class="info-label">Complaint Title</div>
            <div class="info-val">${issue.title}</div>
        </div>
        <div class="info-cell">
            <div class="info-label">Category</div>
            <div class="info-val">${issue.category}</div>
        </div>
        <div class="info-cell">
            <div class="info-label">District</div>
            <div class="info-val">${issue.reporter_district || 'N/A'}</div>
        </div>
        <div class="info-cell">
            <div class="info-label">Constituency</div>
            <div class="info-val">${issue.reporter_constituency || 'N/A'}</div>
        </div>
        <div class="info-cell">
            <div class="info-label">Assigned Department</div>
            <div class="info-val">${DEPT_LABELS[issue.department] || issue.department}</div>
        </div>
        <div class="info-cell">
            <div class="info-label">Priority Score</div>
            <div class="info-val" style="color: #d97706;">🔥 ${issue.priority_score || 0} Points (Supports: ${issue.supports_count || 0})</div>
        </div>
        <div class="info-cell full-width">
            <div class="info-label">Location / Address</div>
            <div class="info-val">📍 ${issue.location_name || 'N/A'} ${issue.latitude && issue.longitude ? `(${issue.latitude.toFixed(5)}, ${issue.longitude.toFixed(5)})` : ''}</div>
        </div>
        <div class="info-cell full-width">
            <div class="info-label">Citizen Complaint Description</div>
            <div class="description-box">${cleanDescription}</div>
        </div>
    </div>

    <div class="section-title">Citizen Details</div>
    <div class="grid-info">
        <div class="info-cell">
            <div class="info-label">Citizen Name</div>
            <div class="info-val">👤 ${issue.reported_by_name || issue.reporter_name || 'Citizen'}</div>
        </div>
        <div class="info-cell">
            <div class="info-label">Contact Phone</div>
            <div class="info-val">📞 ${issue.reporter_phone || 'N/A'}</div>
        </div>
        <div class="info-cell full-width">
            <div class="info-label">Contact Email</div>
            <div class="info-val">✉ ${issue.reporter_email || 'N/A'}</div>
        </div>
    </div>

    <div class="section-title">Timeline & History</div>
    <div class="timeline">
        <div class="timeline-item">
            <div class="timeline-dot active"></div>
            <div class="timeline-content">
                <div class="timeline-title">Grievance Registered (PENDING)</div>
                <div class="timeline-time">${createdDate}</div>
                <div style="color: #475569; font-size: 0.8rem; margin-top: 2px;">Complaint arised by citizen in jurisdiction. Assigned to ${DEPT_LABELS[issue.department] || issue.department}.</div>
            </div>
        </div>
        ${issue.status === 'IN_PROGRESS' || issue.status === 'COMPLETED' ? `
        <div class="timeline-item">
            <div class="timeline-dot active"></div>
            <div class="timeline-content">
                <div class="timeline-title">Processing Commenced (IN_PROGRESS)</div>
                <div class="timeline-time">${issue.status === 'IN_PROGRESS' ? updatedDate : createdDate}</div>
                <div style="color: #475569; font-size: 0.8rem; margin-top: 2px;">Authority acknowledged and assigned resources to resolve the grievance.</div>
            </div>
        </div>
        ` : ''}
        ${issue.status === 'COMPLETED' ? `
        <div class="timeline-item">
            <div class="timeline-dot active"></div>
            <div class="timeline-content">
                <div class="timeline-title">Grievance Resolved (COMPLETED)</div>
                <div class="timeline-time">${updatedDate}</div>
                <div style="color: #475569; font-size: 0.8rem; margin-top: 2px;">Resolution completed. Verification proof uploaded by department authority.</div>
            </div>
        </div>
        ` : ''}
    </div>

    <div class="section-title">Evidence & Verification</div>
    <div class="evidence-container">
        <div class="evidence-card">
            <div class="evidence-img-label">Before (Citizen Uploaded Evidence)</div>
            ${issue.image_url ? `<img class="evidence-img" src="${issue.image_url}" alt="Before image upload">` : '<div style="height:200px; line-height:200px; color:#94a3b8; font-size:0.9rem; font-weight:700; background:#f1f5f9;">No Image Uploaded</div>'}
        </div>
        <div class="evidence-card">
            <div class="evidence-img-label">After (Resolution Proof)</div>
            ${issue.completion_image_url ? `<img class="evidence-img" src="${issue.completion_image_url}" alt="After resolution image">` : '<div style="height:200px; line-height:200px; color:#94a3b8; font-size:0.9rem; font-weight:700; background:#f1f5f9;">No Proof Uploaded Yet</div>'}
        </div>
    </div>

    <div class="section-title">Resolution Review & Citizen Feedback</div>
    <div class="info-cell full-width" style="margin-top: 10px;">
        ${review ? `
            <div style="display:flex; justify-content:space-between; margin-bottom: 6px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 6px;">
                <span style="font-weight:700; font-size: 0.9rem; color:#0f172a;">Review by: ${review.user_name}</span>
                <span style="color:#f59e0b; font-weight:700; font-size:1.05rem;">Rating: ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)} (${review.rating}/5)</span>
            </div>
            <div style="font-style: italic; font-size:0.9rem; color:#334155; line-height: 1.6;">
                "${review.comment || 'No feedback comment recorded'}"
            </div>
            <div style="font-size:0.75rem; color:#94a3b8; text-align:right; margin-top:6px;">
                Submitted on: ${new Date(review.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
        ` : `
            <div style="color:#64748b; font-style: italic; font-size:0.88rem; text-align:center; padding: 12px;">
                ${issue.status === 'COMPLETED' ? 'No citizen feedback or review submitted yet.' : 'Citizen feedback will be available once the issue status is updated to completed.'}
            </div>
        `}
    </div>

    <div class="gov-footer">
        CONFIDENTIAL — GOVERNMENT OF TAMIL NADU — CIVIC PLATFORM MAKKALKURAL — FOR OFFICIAL USE ONLY
    </div>

</body>
</html>`);

    printWin.document.close();

    // Wait for all images in the document to load before printing
    const images = printWin.document.querySelectorAll('img');
    let loadedCount = 0;
    if (images.length === 0) {
        setTimeout(() => printWin.print(), 500);
    } else {
        images.forEach(img => {
            if (img.complete) {
                loadedCount++;
                if (loadedCount === images.length) {
                    setTimeout(() => printWin.print(), 500);
                }
            } else {
                img.onload = () => {
                    loadedCount++;
                    if (loadedCount === images.length) {
                        setTimeout(() => printWin.print(), 500);
                    }
                };
                img.onerror = () => {
                    loadedCount++;
                    if (loadedCount === images.length) {
                        setTimeout(() => printWin.print(), 500);
                    }
                };
            }
        });
    }
}
