import PropTypes from "prop-types";

const API_BASE_URL = "http://localhost:8080/api";

const SongList = ({songs, setSongs, onEditSong}) => {
    const handleDeleteSong = async (songId) => {
        if (!window.confirm("정말 이 노래를 삭제하시겠습니까?")) return;
        try {
            const response = await fetch(`${API_BASE_URL}/songs/${songId}`, {method: "DELETE"});
            if (!response.ok) throw new Error("노래 삭제 실패");
            setSongs(songs.filter(song => song.id !== songId));
        } catch (error) {
            alert("노래 삭제 중 오류 발생.");
        }
    };

    return (
        <div>
            <h3>추가된 노래 목록</h3>
            <ul>
                {songs.map(song => (
                    <li key={song.id}>
                        {song.title} - {song.artist} ({Math.floor(song.startTime / 60)}:{String(song.startTime % 60).padStart(2, '0')} - {Math.floor(song.endTime / 60)}:{String(song.endTime % 60).padStart(2, '0')})
                        <button onClick={() => onEditSong(song)}>수정</button>
                        <button onClick={() => handleDeleteSong(song.id)}>삭제</button>
                    </li>
                ))}
            </ul>
        </div>
    );
};
SongList.propTypes = {
    songs: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.number.isRequired,
            title: PropTypes.string.isRequired,
            artist: PropTypes.string.isRequired,
            startTime: PropTypes.number.isRequired,
            endTime: PropTypes.number.isRequired,
        })
    ).isRequired,
    setSongs: PropTypes.func.isRequired,
    onEditSong: PropTypes.func.isRequired,
};

export default SongList;
