# Quiz Triết học Mác - Lênin

Trang web trắc nghiệm chủ đề học thuyết hình thái Kinh tế - Xã hội, giúp sinh viên ôn bài qua các câu hỏi có tính giờ.
Mỗi người chỉ được làm **một lần**, điểm = tổng số giây còn lại ở các câu trả lời đúng, có bảng xếp hạng top 10.

## Công nghệ
HTML, CSS, JavaScript thuần (frontend) · Node.js + Express (backend)

## Cấu trúc
```
server.js        # API + phục vụ giao diện
package.json
public/
  quiz.html  quiz.css  base.css  quiz.js
data.json        # tự tạo khi có người làm bài (không đưa lên git)
```

## Cài đặt & chạy
```bash
git clone https://github.com/KleinEverhart/quiz.git
cd quiz
npm install
npm start
```
Mở http://localhost:3000 (không mở trực tiếp file `quiz.html`).

## Cấu hình
- Câu hỏi và thời gian mỗi câu (`TIME_PER_QUESTION`): sửa trong `server.js`.
- Đổi cổng: `PORT=4000 npm start`.
- Cho một người làm lại: xóa mục tên của họ trong `data.json`, khởi động lại server, và để họ xóa dữ liệu trang trong trình duyệt.

## Tác giả
Nguyễn Nhật Khôi