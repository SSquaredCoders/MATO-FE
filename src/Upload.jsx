import React, { useState } from "react";
import axios from "axios";

const API_URL = "http://localhost:8080/upload";

function Upload() {
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [file, setFile] = useState(null);

    const handleYoutubeDownload = () => {
        axios.post(`${API_URL}/youtube`, null, { params: { url: youtubeUrl } })
            .then(response => alert(response.data))
            .catch(error => alert("오류 발생: " + error));
    };

    const handleFileUpload = () => {
        const formData = new FormData();
        formData.append("file", file);

        axios.post(`${API_URL}/file`, formData, { headers: { "Content-Type": "multipart/form-data" } })
            .then(response => alert(response.data))
            .catch(error => alert("오류 발생: " + error));
    };

    return (
        <div>
            <h2>노래 업로드</h2>

            {/* 유튜브 다운로드 */}
            <input
                type="text"
                placeholder="유튜브 링크 입력"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
            />
            <button onClick={handleYoutubeDownload}>다운로드</button>

            <hr />

            {/* 파일 업로드 */}
            <input type="file" accept="audio/*,video/*" onChange={(e) => setFile(e.target.files[0])} />
            <button onClick={handleFileUpload}>파일 업로드</button>
        </div>
    );
}

export default Upload;
