import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ComplaintPhotoModal } from '../components/ComplaintPhotoModal';
import type { Complaint } from '../types/civic';

const sampleComplaint: Complaint = {
  id: 'c1',
  tracking_code: 'CC-2026-PHOTO1',
  citizen_id: 'u1',
  category_id: 'cat1',
  department_id: 'dept1',
  title: 'Deep pothole near Central Junction',
  description: 'Large crater causing two-wheeler skids after rain.',
  address: '42 Main Market Road, Ward 7',
  latitude: 17.385,
  longitude: 78.4867,
  priority: 'high',
  status: 'submitted',
  photo_urls: ['u1/photo-1.jpg', 'u1/photo-2.jpg'],
  signed_photo_urls: [
    'https://example.com/signed-photo-1.jpg',
    'https://example.com/signed-photo-2.jpg',
  ],
  created_at: '2026-11-28T06:00:00Z',
  updated_at: '2026-11-28T06:00:00Z',
  department: { name: 'Roads & Public Works', code: 'ROADS' },
};

describe('ComplaintPhotoModal (Municipal & Citizen Photo Evidence Viewer)', () => {
  it('renders problem photo, full description, and switches between photos', () => {
    const onClose = vi.fn();
    render(<ComplaintPhotoModal complaint={sampleComplaint} onClose={onClose} />);

    expect(screen.getByText('CC-2026-PHOTO1')).toBeInTheDocument();
    expect(screen.getByText('Deep pothole near Central Junction')).toBeInTheDocument();
    expect(
      screen.getByText('Large crater causing two-wheeler skids after rain.')
    ).toBeInTheDocument();
    expect(screen.getByText('Photo 1 of 2')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Next photo'));
    expect(screen.getByText('Photo 2 of 2')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Close photo viewer'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
