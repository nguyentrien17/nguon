import { useEffect, useRef } from 'react';

/**
 * Ô tích ba trạng thái: tích / không tích / một phần (indeterminate) — dùng cho nút "chọn tất
 * cả" của một nhóm (vd một module trong cây phân quyền). Thuộc tính indeterminate không đặt được
 * qua JSX, phải gán qua ref.
 *
 *   <TriStateCheckbox checked={all} indeterminate={some && !all} onChange={toggleAll} aria-label={...} />
 */
export default function TriStateCheckbox({ checked, indeterminate = false, onChange, disabled = false, ...rest }) {
    const ref = useRef(null);
    useEffect(() => {
        if (ref.current) ref.current.indeterminate = indeterminate;
    }, [indeterminate]);
    return <input ref={ref} type="checkbox" checked={!!checked} onChange={onChange} disabled={disabled} readOnly={!onChange} {...rest} />;
}
