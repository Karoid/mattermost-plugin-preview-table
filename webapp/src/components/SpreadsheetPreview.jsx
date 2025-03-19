import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Spreadsheet } from 'react-spreadsheet';
import * as XLSX from 'xlsx';
import PropTypes from 'prop-types';

const CHUNK_SIZE = 30;

const SpreadsheetPreview = ({ fileInfo, fileUrl }) => {
    const [data, setData] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [totalRows, setTotalRows] = useState({});
    const [currentChunk, setCurrentChunk] = useState({});
    const [processingData, setProcessingData] = useState(false);
    const [activeSheet, setActiveSheet] = useState('');
    const [sheetNames, setSheetNames] = useState([]);
    const fileDataRef = useRef(null);
    const observerRef = useRef(null);

    const processChunk = useCallback((sheet, range, startRow, endRow) => {
        const chunkData = [];
        for (let row = startRow; row <= Math.min(endRow, range.e.r); row++) {
            const rowData = [];
            for (let col = range.s.c; col <= range.e.c; col++) {
                const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
                const cell = sheet[cellAddress];
                rowData.push({
                    value: cell ? cell.v : '',
                });
            }
            chunkData.push(rowData);
        }
        return chunkData;
    }, []);

    const loadNextChunk = useCallback((sheetName) => {
        if (processingData || !fileDataRef.current) {
            return;
        }

        const {workbook, ranges} = fileDataRef.current;
        const sheet = workbook.Sheets[sheetName];
        const range = ranges[sheetName];

        const startRow = range.s.r + (currentChunk[sheetName] * CHUNK_SIZE);
        if (startRow > range.e.r) {
            return;
        }

        setProcessingData(true);
        const nextChunk = processChunk(
            sheet,
            range,
            startRow,
            (startRow + CHUNK_SIZE) - 1,
        );

        setData((prevData) => ({
            ...prevData,
            [sheetName]: [...(prevData[sheetName] || []), ...nextChunk],
        }));

        setCurrentChunk((prev) => ({
            ...prev,
            [sheetName]: (prev[sheetName] || 0) + 1,
        }));

        setProcessingData(false);
    }, [currentChunk, processingData, processChunk]);

    useEffect(() => {
        const loadFile = async () => {
            setLoading(true);
            setError(null);

            try {
                const response = await fetch(fileUrl);
                const blob = await response.blob();
                const buffer = await blob.arrayBuffer();
                const workbook = XLSX.read(buffer, { type: 'array' });
                const sheets = {};
                const ranges = {};
                const chunks = {};
                const totals = {};

                workbook.SheetNames.forEach((sheetName) => {
                    const sheet = workbook.Sheets[sheetName];
                    const range = XLSX.utils.decode_range(sheet['!ref']);
                    ranges[sheetName] = range;
                    totals[sheetName] = (range.e.r - range.s.r) + 1;
                    chunks[sheetName] = 1;

                    const initialChunk = processChunk(
                        sheet,
                        range,
                        range.s.r,
                        (range.s.r + CHUNK_SIZE) - 1,
                    );
                    sheets[sheetName] = initialChunk;
                });

                fileDataRef.current = { workbook, ranges };
                setData(sheets);
                setTotalRows(totals);
                setCurrentChunk(chunks);
                setSheetNames(workbook.SheetNames);
                setActiveSheet(workbook.SheetNames[0]);
                setLoading(false);
            } catch (err) {
                setError(`파일을 불러오는 중 오류가 발생했습니다: ${err.message}`);
                setLoading(false);
            }
        };

        loadFile();

        return () => {
            if (observerRef.current) {
                observerRef.current.disconnect();
            }
        };
    }, [fileUrl, fileInfo.mime_type, processChunk]);

    useEffect(() => {
        if (!loading && activeSheet) {
            observerRef.current?.disconnect();

            const observer = new IntersectionObserver(
                (entries) => {
                    if (entries[0].isIntersecting) {
                        loadNextChunk(activeSheet);
                    }
                },
                { threshold: 0.5 },
            );

            const sentinel = document.querySelector('.spreadsheet-preview__sentinel');
            if (sentinel) {
                observer.observe(sentinel);
                observerRef.current = observer;
            }
        }
    }, [loading, activeSheet, loadNextChunk]);

    if (loading) {
        return (
            <div className='spreadsheet-preview__loading'>
                <div className='spreadsheet-preview__loading-spinner'/>
                <p>{'스프레드시트를 불러오는 중...'}</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className='spreadsheet-preview__error'>
                <p>{error}</p>
            </div>
        );
    }

    return (
        <div className='spreadsheet-preview__wrapper'>
            <div className='spreadsheet-preview__tabs'>
                {sheetNames.map((sheetName) => (
                    <button
                        key={sheetName}
                        className={`spreadsheet-preview__tab ${activeSheet === sheetName ? 'active' : ''}`}
                        onClick={() => setActiveSheet(sheetName)}
                    >
                        {sheetName}
                    </button>
                ))}
            </div>
            <div className='spreadsheet-preview__container'>
                <Spreadsheet data={data[activeSheet] || []}/>
                {(currentChunk[activeSheet] * CHUNK_SIZE) < totalRows[activeSheet] && (
                    <div className='spreadsheet-preview__sentinel'>
                        {'데이터 로드 중...'}
                    </div>
                )}
            </div>
        </div>
    );
};

SpreadsheetPreview.propTypes = {
    fileInfo: PropTypes.shape({
        id: PropTypes.string,
        mime_type: PropTypes.string.isRequired,
        link: PropTypes.string,
    }).isRequired,
    fileUrl: PropTypes.string.isRequired,
};

export default SpreadsheetPreview;