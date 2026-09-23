import { useState } from 'react';
import { ArrowDown, Check, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { ConfirmActionDialog } from '@/components/ui/confirm-action-dialog';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { SpinnerInline } from '@/components/ui/spinner';

const swatches = [
  ['바탕', 'background', 'bg-background'],
  ['종이', 'card', 'bg-card'],
  ['잉크', 'foreground', 'bg-foreground'],
  ['주요 행동', 'primary', 'bg-primary'],
  ['보조 행동', 'secondary', 'bg-secondary'],
  ['강조', 'accent', 'bg-accent'],
] as const;

export function DesignSystemGallery() {
  const [title, setTitle] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const invalid = submitted && !title.trim();

  async function save() {
    setSubmitted(true);
    if (!title.trim()) return;
    setPending(true);
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    setPending(false);
    setSaved(true);
  }

  return (
    <TooltipProvider>
      <main className="ds-gallery" id="main-content">
        <header className="ds-masthead">
          <a href="/" className="font-display text-2xl">
            Margins
          </a>
          <Badge variant="outline">Design system · 01</Badge>
        </header>
        <div className="ds-intro">
          <p className="ds-eyebrow">읽는 경험을 위한 공통 언어</p>
          <h1>
            작은 요소부터,
            <br />
            일관된 독서 경험까지.
          </h1>
          <p>
            종이의 따뜻함, 명확한 정보 위계, 예측 가능한 상호작용.
            <br />
            실제 앱과 같은 컴포넌트로 색상과 상태를 살펴보세요.
          </p>
          <Button asChild variant="outline">
            <a href="#controls">
              컴포넌트 살펴보기 <ArrowDown size={16} />
            </a>
          </Button>
        </div>
        <nav className="ds-index" aria-label="디자인 시스템 목차">
          <a href="#foundations">01 기초</a>
          <a href="#controls">02 컨트롤</a>
          <a href="#forms">03 입력</a>
          <a href="#feedback">04 피드백</a>
          <a href="#overlays">05 오버레이</a>
        </nav>

        <section id="foundations" className="ds-section" aria-labelledby="foundations-title">
          <div className="ds-section-heading">
            <span>01 / Foundations</span>
            <h2 id="foundations-title">색상과 리듬</h2>
          </div>
          <div className="ds-swatches">
            {swatches.map(([label, token, className]) => (
              <div key={token}>
                <div className={`ds-swatch ${className}`} />
                <strong>{label}</strong>
                <code>{token}</code>
              </div>
            ))}
          </div>
          <div className="ds-grid mt-6">
            <Card>
              <CardHeader>
                <CardTitle>타이포그래피</CardTitle>
                <CardDescription>
                  Display · Newsreader / 본문 · Inter / 한국어 · Noto Sans KR
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-display text-3xl">Between the lines</p>
                <p className="mt-3 leading-7">
                  책의 여백에 남겨둔 생각이 다음 대화의 시작이 됩니다. 한국어 문장과 긴 제목도
                  자연스럽게 읽히도록 구성합니다.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>간격</CardTitle>
                <CardDescription>4 · 8 · 12 · 16 · 24 · 32px</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p>컨트롤 사이 8px</p>
                <p>카드 안쪽 16px</p>
                <p>섹션 사이 24px</p>
                <p className="text-muted-foreground">터치 환경의 컨트롤은 최소 44 × 44px</p>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="controls" className="ds-section" aria-labelledby="controls-title">
          <div className="ds-section-heading">
            <span>02 / Controls</span>
            <h2 id="controls-title">행동의 중요도를 분명하게</h2>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Button</CardTitle>
              <CardDescription>
                기본은 따뜻한 보조 색상. 가장 중요한 행동에만 navy primary를 사용합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="ds-row">
                <Button variant="default">
                  <Plus />
                  기록 추가
                </Button>
                <Button>보조 행동</Button>
                <Button variant="outline">외곽선</Button>
                <Button variant="ghost">가벼운 행동</Button>
                <Button variant="destructive">
                  <Trash2 />
                  삭제
                </Button>
                <Button variant="link">더 알아보기</Button>
              </div>
              <div className="ds-row">
                <Button size="sm">작은 버튼</Button>
                <Button size="lg">큰 버튼</Button>
                <Button disabled>사용 불가</Button>
                <Button loading loadingLabel="저장 중">
                  저장
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" aria-label="검색">
                      <Search />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>검색</TooltipContent>
                </Tooltip>
              </div>
            </CardContent>
          </Card>
          <div className="ds-grid mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Tabs</CardTitle>
                <CardDescription>화살표 키로 선택한 탭이 이동합니다.</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="record">
                  <TabsList aria-label="기록 보기">
                    <TabsTrigger value="record">기록</TabsTrigger>
                    <TabsTrigger value="discussion">대화</TabsTrigger>
                  </TabsList>
                  <TabsContent value="record">책에서 발견한 생각을 기록합니다.</TabsContent>
                  <TabsContent value="discussion">다양한 관점으로 생각을 나눕니다.</TabsContent>
                </Tabs>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Toggle group</CardTitle>
                <CardDescription>선택 상태는 색상과 의미 속성으로 함께 전달합니다.</CardDescription>
              </CardHeader>
              <CardContent>
                <ToggleGroup type="single" defaultValue="list" aria-label="표시 방식">
                  <ToggleGroupItem value="list">목록</ToggleGroupItem>
                  <ToggleGroupItem value="grid">격자</ToggleGroupItem>
                </ToggleGroup>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="forms" className="ds-section" aria-labelledby="forms-title">
          <div className="ds-section-heading">
            <span>03 / Forms</span>
            <h2 id="forms-title">안내하고, 확인하고, 저장하기</h2>
          </div>
          <div className="ds-grid">
            <Card>
              <CardHeader>
                <CardTitle>기록 작성 예시</CardTitle>
                <CardDescription>
                  빈 제목으로 저장하면 오류 상태를 확인할 수 있습니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  id="sample-form"
                  className="space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void save();
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="sample-title">제목 (필수)</Label>
                    <Input
                      id="sample-title"
                      value={title}
                      onChange={(event) => {
                        setTitle(event.target.value);
                        setSaved(false);
                      }}
                      aria-invalid={invalid}
                      aria-describedby={invalid ? 'sample-error' : 'sample-hint'}
                      placeholder="기억하고 싶은 한 문장"
                    />
                    <p
                      id={invalid ? 'sample-error' : 'sample-hint'}
                      className={
                        invalid ? 'text-destructive text-sm' : 'text-muted-foreground text-sm'
                      }
                      role={invalid ? 'alert' : undefined}
                    >
                      {invalid
                        ? '제목을 입력해 주세요.'
                        : '책을 다시 펼칠 때 떠올릴 수 있는 제목이면 좋아요.'}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sample-note">내용</Label>
                    <Textarea id="sample-note" placeholder="어떤 생각이 들었나요?" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sample-status">독서 상태</Label>
                    <Select defaultValue="reading">
                      <SelectTrigger id="sample-status" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reading">읽는 중</SelectItem>
                        <SelectItem value="complete">완독</SelectItem>
                        <SelectItem value="planned">읽을 예정</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="ds-row">
                    <Checkbox id="sample-reminder" />
                    <Label htmlFor="sample-reminder">나중에 다시 읽기</Label>
                  </div>
                </form>
              </CardContent>
              <CardFooter className="justify-between gap-4">
                <span className="text-muted-foreground text-xs">
                  이 예시는 서버에 저장되지 않습니다.
                </span>
                <Button
                  form="sample-form"
                  type="submit"
                  variant="default"
                  loading={pending}
                  loadingLabel="저장 중"
                >
                  저장하기
                </Button>
              </CardFooter>
            </Card>
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>입력 상태</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="disabled-input">사용 불가</Label>
                    <Input id="disabled-input" disabled value="수정할 수 없는 항목" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invalid-input">검증 오류</Label>
                    <Input
                      id="invalid-input"
                      aria-invalid
                      aria-describedby="invalid-description"
                      defaultValue="잘못된 값"
                    />
                    <p id="invalid-description" className="text-sm text-destructive">
                      입력한 내용을 확인해 주세요.
                    </p>
                  </div>
                </CardContent>
              </Card>
              {saved && (
                <Alert variant="success" role="status">
                  <Check />
                  <AlertTitle>저장 완료</AlertTitle>
                  <AlertDescription>‘{title}’ 예시가 저장되었습니다.</AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </section>

        <section id="feedback" className="ds-section" aria-labelledby="feedback-title">
          <div className="ds-section-heading">
            <span>04 / Feedback</span>
            <h2 id="feedback-title">기다리는 순간에도 명확하게</h2>
          </div>
          <div className="ds-grid">
            {(['info', 'success', 'warning', 'destructive'] as const).map((tone, i) => (
              <Alert key={tone} variant={tone}>
                <AlertTitle>
                  {['안내', '저장 완료', '확인 필요', '다시 시도해 주세요'][i]}
                </AlertTitle>
                <AlertDescription>
                  {
                    [
                      '다음 단계를 안내합니다.',
                      '변경한 내용을 저장했습니다.',
                      '계속하기 전에 내용을 확인해 주세요.',
                      '요청을 처리하지 못했습니다. 입력 내용은 유지됩니다.',
                    ][i]
                  }
                </AlertDescription>
              </Alert>
            ))}
          </div>
          <div className="ds-row mt-6">
            <Badge variant="info">안내</Badge>
            <Badge variant="success">완료</Badge>
            <Badge variant="warning">주의</Badge>
            <Badge variant="destructive">실패</Badge>
            <Badge variant="outline">초안</Badge>
          </div>
          <div className="ds-grid mt-6">
            <Card aria-busy="true">
              <CardHeader>
                <CardTitle>
                  <SpinnerInline>내용을 불러오는 중</SpinnerInline>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>아직 남긴 기록이 없어요</CardTitle>
                <CardDescription>읽으면서 떠오른 생각을 한 문장부터 남겨보세요.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <a href="#forms">
                    <Plus />첫 기록 남기기
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="overlays" className="ds-section" aria-labelledby="overlays-title">
          <div className="ds-section-heading">
            <span>05 / Overlays</span>
            <h2 id="overlays-title">맥락을 유지하는 확인 과정</h2>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Dialog · AlertDialog</CardTitle>
              <CardDescription>
                Escape로 닫기, 키보드 포커스 복귀, 작은 화면의 내부 스크롤을 확인하세요.
              </CardDescription>
            </CardHeader>
            <CardContent className="ds-row">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline">상세 보기</Button>
                </DialogTrigger>
                <DialogContent closeLabel="닫기">
                  <DialogHeader>
                    <DialogTitle>기록 미리보기</DialogTitle>
                    <DialogDescription>긴 내용도 화면 안에서 읽을 수 있습니다.</DialogDescription>
                  </DialogHeader>
                  <p className="break-words leading-7">
                    이야기에서 발견한 작은 질문을 다음 독서로 이어갑니다.{' '}
                    {'긴제목과공백없는문장도안전하게줄바꿈합니다'.repeat(8)}
                  </p>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button>확인</Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button
                variant="destructive"
                onClick={() => {
                  setDeleted(false);
                  setConfirmOpen(true);
                }}
              >
                <Trash2 />
                삭제 확인 열기
              </Button>
              {deleted && <span role="status">예시 기록을 삭제했습니다.</span>}
            </CardContent>
          </Card>
          <ConfirmActionDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="예시 기록을 삭제할까요?"
            description="갤러리의 임시 상태만 변경됩니다. 실제 독서 기록에는 영향을 주지 않습니다."
            cancelLabel="취소"
            confirmLabel="삭제하기"
            loadingLabel="삭제 중"
            onConfirm={async () => {
              await new Promise((resolve) => window.setTimeout(resolve, 650));
              setDeleted(true);
            }}
          />
        </section>
        <footer className="ds-footer">
          Margins / Editorial foundations · Light theme · Source-owned components
        </footer>
      </main>
    </TooltipProvider>
  );
}
