import { describe, expect, it } from 'vitest';
import { getPageItems } from './paginationUtils';

describe('getPageItems', () => {
    it('ít trang: hiện hết', () => {
        expect(getPageItems(1, 1)).toEqual([1]);
        expect(getPageItems(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('nhiều trang: đầu / giữa / cuối có dấu …', () => {
        expect(getPageItems(1, 20)).toEqual([1, 2, 3, 4, 5, 'ellipsis-end', 20]);
        expect(getPageItems(10, 20)).toEqual([1, 'ellipsis-start', 9, 10, 11, 'ellipsis-end', 20]);
        expect(getPageItems(20, 20)).toEqual([1, 'ellipsis-start', 16, 17, 18, 19, 20]);
    });

    it('500 trang không render 500 nút; số ô cố định khi bấm qua lại', () => {
        expect(getPageItems(250, 500).length).toBeLessThanOrEqual(9);
        for (let p = 1; p <= 30; p += 1) expect(getPageItems(p, 30)).toHaveLength(7);
    });

    it('trang ngoài khoảng bị kẹp lại', () => {
        expect(getPageItems(99, 20)).toContain(20);
        expect(getPageItems(-3, 20)[0]).toBe(1);
    });
});
