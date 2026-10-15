import { useEffect, useRef } from 'react';

/**
 * Gọi `handler` khi người dùng bấm Escape, chỉ trong lúc `active` = true (vd modal đang mở).
 * Handler được giữ trong ref nên caller truyền hàm inline thoải mái, không phải useCallback.
 */
export default function useEscapeKey(handler, active = true) {
    const handlerRef = useRef(handler);
    useEffect(() => {
        handlerRef.current = handler;
    });

    useEffect(() => {
        if (!active) return undefined;
        const onKeyDown = (e) => {
            if (e.key === 'Escape') handlerRef.current?.(e);
        };
        document.addEventListener('keydown', onKeyDown);
        return () => document.removeEventListener('keydown', onKeyDown);
    }, [active]);
}
