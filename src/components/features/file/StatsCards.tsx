"use client";

import { useEffect, useState } from "react";
import { useFiles } from "~/hooks";
import { db } from "~/lib/db/db";

interface StatsCardsProps {
  className?: string;
}

export default function StatsCards({ className }: StatsCardsProps) {
  const { files } = useFiles();
  const [processingCount, setProcessingCount] = useState(0);

  // 计算统计数据
  const totalFiles = files.length;
  const totalDuration = files.reduce((acc, file) => acc + (file.duration || 0), 0);

  // Query正在ProcessinTranscription数量
  useEffect(() => {
    const checkProcessingStatus = async () => {
      try {
        const processingTranscripts = await db.transcripts
          .where("status")
          .equals("processing")
          .count();
        setProcessingCount(processingTranscripts);
      } catch {
        setProcessingCount(0);
      }
    };

    checkProcessingStatus();
    // 每 2 secondsCheck一次state
    const interval = setInterval(checkProcessingStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  // 格式化时长
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // 计算当前state
  const getProcessingStatus = () => {
    if (!files || files.length === 0) return "空闲";
    if (processingCount > 0) return "转录中";
    return "空闲";
  };

  // 统计卡片数据
  const stats = [
    {
      label: "已上传文件",
      value: totalFiles.toString(),
      icon: "folder",
    },
    {
      label: "总时长",
      value: formatDuration(totalDuration),
      icon: "schedule",
    },
    {
      label: "当前状态",
      value: getProcessingStatus(),
      icon: "status",
    },
  ];

  return (
    <div className={`grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8 ${className}`}>
      {stats.map((stat) => (
        <div key={stat.label} className="card-default">
          <p className="text-stats-label">{stat.label}</p>
          <p className="text-stats-value">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
