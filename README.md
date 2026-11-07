# Quiz Triết học Mác - Lênin

Trang web trắc nghiệm chủ đề học thuyết hình thái Kinh tế - Xã hội. Có thể làm nhiều lần, điểm = tổng số giây còn lại
ở các câu đúng. Bảng xếp hạng top 10 tính theo **điểm cao nhất** của mỗi người.

**Công nghệ:** HTML, CSS, JavaScript thuần · Node.js + Express · PostgreSQL

## Cấu trúc
```
server.js  package.json  .env.example
public/    quiz.html  quiz.css  base.css  quiz.js
```

## Chạy trên máy
1. Tạo database PostgreSQL (ví dụ miễn phí trên Neon) và lấy chuỗi kết nối.
2. Sao chép `.env.example` thành `.env`, điền `DATABASE_URL`.
3. `npm install` rồi `npm start` (hoặc `npm run dev` để tự khởi động lại khi sửa code).
4. Mở http://localhost:3000

Bảng `quiz_attempts` được tạo tự động khi server khởi động.

## Triển khai (Render + Neon)
Web Service: Build `npm install`, Start `npm start`. Biến môi trường: `DATABASE_URL`, `PGSSL=true`.

## Quản trị (SQL Editor của Neon hoặc psql)
```sql
SELECT name, score, accuracy, finished_at FROM quiz_attempts WHERE finished ORDER BY score DESC;
DELETE FROM quiz_attempts WHERE name_key = 'nguyen van a';   -- xóa mọi lượt của một người
DELETE FROM quiz_attempts;                                    -- xóa toàn bộ để bắt đầu đợt mới
```

## Cấu hình
Câu hỏi và `TIME_PER_QUESTION` sửa trong `server.js`.

## Tác giả
Nguyễn Nhật Khôi