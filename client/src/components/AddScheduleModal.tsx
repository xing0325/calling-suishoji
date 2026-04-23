import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Bell, BellOff } from "lucide-react";

interface AddScheduleModalProps {
  open: boolean;
  date: string; // YYYY-MM-DD
  onClose: () => void;
  onAdded: () => void;
}

export default function AddScheduleModal({ open, date, onClose, onAdded }: AddScheduleModalProps) {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [description, setDescription] = useState("");
  const [remindEnabled, setRemindEnabled] = useState(false);

  // 重置表单
  useEffect(() => {
    if (open) {
      setTitle("");
      setTime("");
      setDescription("");
      setRemindEnabled(false);
    }
  }, [open]);

  const createSchedule = trpc.schedules.create.useMutation({
    onSuccess: async () => {
      toast.success("日程已添加");
      // 如果开启提醒，请求通知权限并订阅 Push
      if (remindEnabled) {
        await requestPushPermission();
      }
      onAdded();
      onClose();
    },
    onError: (err) => {
      toast.error("添加失败：" + err.message);
    },
  });

  const savePushSub = trpc.schedules.savePushSubscription.useMutation();
  const { data: vapidData } = trpc.schedules.getVapidPublicKey.useQuery(undefined, {
    enabled: remindEnabled,
  });

  async function requestPushPermission() {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      toast.error("此浏览器不支持推送通知");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      toast.error("通知权限被拒绝，提醒功能不可用");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const publicKey = vapidData?.publicKey;
      if (!publicKey) return;

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const subJson = sub.toJSON();
      if (subJson.endpoint && subJson.keys) {
        await savePushSub.mutateAsync({
          endpoint: subJson.endpoint,
          keys: subJson.keys as { p256dh: string; auth: string },
        });
      }
    } catch (err) {
      console.error("[Push] 订阅失败:", err);
    }
  }

  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  function handleSubmit() {
    if (!title.trim()) {
      toast.error("请输入日程标题");
      return;
    }
    createSchedule.mutate({
      date,
      time: time || undefined,
      title: title.trim(),
      description: description.trim() || undefined,
      remindEnabled,
    });
  }

  // 格式化日期显示
  const displayDate = (() => {
    const d = new Date(date + "T00:00:00");
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  })();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-[#1a1a2e] border-purple-800/30 text-white max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle className="text-purple-300 font-semibold">
            添加日程 · {displayDate}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* 标题 */}
          <div className="space-y-1.5">
            <Label className="text-gray-300 text-sm">日程标题 *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入日程内容..."
              className="bg-[#0f0f23] border-purple-800/30 text-white placeholder:text-gray-500 focus:border-purple-500"
              maxLength={200}
              autoFocus
            />
          </div>

          {/* 时间（可选） */}
          <div className="space-y-1.5">
            <Label className="text-gray-300 text-sm">具体时间（可选）</Label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="bg-[#0f0f23] border-purple-800/30 text-white focus:border-purple-500"
            />
          </div>

          {/* 备注（可选） */}
          <div className="space-y-1.5">
            <Label className="text-gray-300 text-sm">备注（可选）</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="添加备注..."
              className="bg-[#0f0f23] border-purple-800/30 text-white placeholder:text-gray-500 focus:border-purple-500 resize-none"
              rows={2}
              maxLength={500}
            />
          </div>

          {/* 提醒开关 */}
          <div className="flex items-center justify-between py-2 px-3 bg-[#0f0f23] rounded-lg border border-purple-800/20">
            <div className="flex items-center gap-2">
              {remindEnabled ? (
                <Bell className="w-4 h-4 text-purple-400" />
              ) : (
                <BellOff className="w-4 h-4 text-gray-500" />
              )}
              <div>
                <p className="text-sm text-gray-200">到时提醒</p>
                <p className="text-xs text-gray-500">
                  {remindEnabled
                    ? time
                      ? `将在 ${time} 推送通知`
                      : "将在当天 09:00 推送通知"
                    : "不提醒"}
                </p>
              </div>
            </div>
            <Switch
              checked={remindEnabled}
              onCheckedChange={setRemindEnabled}
              className="data-[state=checked]:bg-purple-600"
            />
          </div>

          {remindEnabled && (
            <p className="text-xs text-gray-500 px-1">
              首次使用需授权浏览器通知权限。iOS 用户请先将网页添加到主屏幕。
            </p>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 border-purple-800/30 text-gray-300 hover:bg-purple-900/20"
            >
              取消
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createSchedule.isPending}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
            >
              {createSchedule.isPending ? "添加中..." : "添加日程"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
