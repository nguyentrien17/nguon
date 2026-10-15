import { useState } from 'react';
import { assetUrl } from '@/core/api/axiosClient';
import './ui.css';

function initials(name = '') {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(-2)
        .map((p) => p[0]?.toUpperCase())
        .join('');
}

/**
 * Ảnh đại diện; không có ảnh (hoặc ảnh lỗi) thì hiện chữ cái đầu của tên.
 *
 *   <Avatar src={user.avatar} name={user.full_name} size={32} />
 *
 * `src` là đường dẫn server trả về ('/uploads/avatars/x.png') hoặc URL tuyệt đối.
 */
export default function Avatar({ src, name, size = 32, className = '' }) {
    const [failedSrc, setFailedSrc] = useState(null);
    const url = assetUrl(src);
    const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
    const classes = ['avatar-circle', className].filter(Boolean).join(' ');

    if (url && failedSrc !== url) {
        return <img src={url} alt={name || ''} className={`${classes} avatar-img`} style={style} onError={() => setFailedSrc(url)} />;
    }
    return (
        <span className={classes} style={style} aria-hidden={name ? undefined : true}>
            {initials(name)}
        </span>
    );
}
