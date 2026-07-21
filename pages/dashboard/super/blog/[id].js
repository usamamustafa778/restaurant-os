import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import Script from "next/script";
import { useRouter } from "next/router";
import AdminLayout from "../../../../components/layout/AdminLayout";
import SuperPageGate from "../../../../components/super/SuperPageGate";
import {
  createBlogPostForSuperAdmin,
  getBlogPostForSuperAdmin,
  getStoredAuth,
  publishBlogPostForSuperAdmin,
  unpublishBlogPostForSuperAdmin,
  updateBlogPostForSuperAdmin,
  uploadBlogImageForSuperAdmin,
} from "../../../../lib/apiClient";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Loader2,
  Lock,
  Save,
  Send,
} from "lucide-react";
import toast from "react-hot-toast";

const CATEGORIES = [
  "POS",
  "Marketing",
  "Inventory",
  "AI",
  "Restaurant Tips",
  "Case Studies",
];

const EMPTY_POST = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  coverImage: "",
  category: "Restaurant Tips",
  tags: [],
  relatedCities: [],
  status: "draft",
  publishedAt: null,
  author: "",
  seoTitle: "",
  seoDescription: "",
  featured: false,
};

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function countWords(html) {
  const text = String(html || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.split(" ").length : 0;
}

function normalizePost(post) {
  return {
    ...EMPTY_POST,
    ...post,
    tags: Array.isArray(post?.tags) ? post.tags : [],
    relatedCities: Array.isArray(post?.relatedCities)
      ? post.relatedCities
      : [],
  };
}

export default function BlogEditorPage() {
  const router = useRouter();
  const routeId = router.query.id;
  const isNew = routeId === "new";
  const editorRef = useRef(null);
  const quillRef = useRef(null);
  const saveRef = useRef(null);
  const postRef = useRef(EMPTY_POST);
  const [post, setPost] = useState(EMPTY_POST);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [quillReady, setQuillReady] = useState(false);
  const [seoOpen, setSeoOpen] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [citiesInput, setCitiesInput] = useState("");

  const slugLocked = Boolean(post.publishedAt);
  const wordCount = useMemo(() => countWords(post.content), [post.content]);
  const estimatedReadTime = Math.max(1, Math.ceil(wordCount / 200));

  useEffect(() => {
    postRef.current = post;
  }, [post]);

  useEffect(() => {
    if (!router.isReady) return;
    if (isNew) {
      const auth = getStoredAuth();
      const name =
        auth?.user?.name || auth?.user?.email || "EatsDesk Team";
      setPost({ ...EMPTY_POST, author: name });
      setLoading(false);
      return;
    }

    let cancelled = false;
    getBlogPostForSuperAdmin(routeId)
      .then((data) => {
        if (cancelled) return;
        const next = normalizePost(data?.post);
        setPost(next);
        setTagsInput(next.tags.join(", "));
        setCitiesInput(next.relatedCities.join(", "));
      })
      .catch((error) => toast.error(error.message || "Could not load post"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router.isReady, routeId, isNew]);

  useEffect(() => {
    if (!quillReady || loading || !editorRef.current || quillRef.current) return;
    if (!window.Quill) return;

    const quill = new window.Quill(editorRef.current, {
      theme: "snow",
      placeholder: "Write the article…",
      modules: {
        toolbar: [
          [{ header: [2, 3, false] }],
          ["bold", "italic", "blockquote", "code-block"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["link", "image"],
          ["clean"],
        ],
      },
    });
    quill.root.innerHTML = postRef.current.content || "";
    quill.on("text-change", () => {
      setPost((current) => ({ ...current, content: quill.root.innerHTML }));
    });
    quillRef.current = quill;
  }, [quillReady, loading]);

  const payloadFromPost = useCallback((value) => {
    const parseList = (input) =>
      [...new Set(String(input || "").split(",").map((v) => v.trim()).filter(Boolean))];
    return {
      ...value,
      tags: parseList(tagsInput),
      relatedCities: parseList(citiesInput),
    };
  }, [tagsInput, citiesInput]);

  const saveDraft = useCallback(
    async ({ quiet = false } = {}) => {
      const current = postRef.current;
      if (!current.title.trim()) {
        if (!quiet) toast.error("Add a title before saving");
        return null;
      }
      try {
        setSaving(true);
        let saved;
        if (isNew) {
          const data = await createBlogPostForSuperAdmin(payloadFromPost(current));
          saved = normalizePost(data?.post);
          await router.replace(`/super/blog/${saved._id}`, undefined, {
            shallow: true,
          });
        } else {
          const data = await updateBlogPostForSuperAdmin(
            routeId,
            payloadFromPost(current),
          );
          saved = normalizePost(data?.post);
        }
        setPost(saved);
        postRef.current = saved;
        setSavedAt(new Date());
        if (!quiet) toast.success("Draft saved");
        return saved;
      } catch (error) {
        if (!quiet) toast.error(error.message || "Could not save post");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [isNew, payloadFromPost, routeId, router],
  );

  useEffect(() => {
    saveRef.current = saveDraft;
  }, [saveDraft]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (postRef.current.title.trim()) {
        void saveRef.current?.({ quiet: true });
      }
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  function update(field, value) {
    setPost((current) => {
      const next = { ...current, [field]: value };
      if (field === "title" && !slugTouched && !slugLocked) {
        next.slug = slugify(value);
      }
      return next;
    });
  }

  async function publish() {
    let target = post;
    if (isNew || !savedAt) {
      target = await saveDraft({ quiet: true });
      if (!target) return;
    } else {
      target = await saveDraft({ quiet: true });
      if (!target) return;
    }
    try {
      setSaving(true);
      const data = await publishBlogPostForSuperAdmin(target._id);
      const next = normalizePost(data?.post);
      setPost(next);
      postRef.current = next;
      toast.success("Post published");
    } catch (error) {
      toast.error(error.message || "Could not publish post");
    } finally {
      setSaving(false);
    }
  }

  async function unpublish() {
    try {
      setSaving(true);
      const data = await unpublishBlogPostForSuperAdmin(post._id);
      const next = normalizePost(data?.post);
      setPost(next);
      postRef.current = next;
      toast.success("Post moved to draft");
    } catch (error) {
      toast.error(error.message || "Could not unpublish post");
    } finally {
      setSaving(false);
    }
  }

  async function uploadCover(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const data = await uploadBlogImageForSuperAdmin(file);
      update("coverImage", data.url || "");
      toast.success("Cover image uploaded");
    } catch (error) {
      toast.error(error.message || "Upload failed; paste an external URL");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  if (loading) {
    return (
      <AdminLayout title="Blog Editor">
        <SuperPageGate permission="platform.blog.view">
          <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Loading editor…
          </div>
        </SuperPageGate>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Blog Editor" subtitle="">
      <SuperPageGate permission="platform.blog.manage">
        <Head>
          <link
            rel="stylesheet"
            href="https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.snow.min.css"
          />
        </Head>
        <Script
          src="https://cdnjs.cloudflare.com/ajax/libs/quill/1.3.7/quill.min.js"
          strategy="afterInteractive"
          onLoad={() => setQuillReady(true)}
        />

        <div className="-mx-1 space-y-5 pb-16">
          <div className="sticky top-0 z-20 -mx-4 -mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95 md:-mx-6 md:px-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/super/blog")}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {isNew ? "New blog post" : post.title || "Untitled"}
                </p>
                <p className="text-xs text-gray-500">
                  {saving
                    ? "Saving…"
                    : savedAt
                      ? `Saved ${savedAt.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`
                      : "Not saved yet"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {post.status === "published" ? (
                <button
                  type="button"
                  onClick={unpublish}
                  disabled={saving}
                  className="h-10 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 dark:border-neutral-700 dark:text-neutral-200"
                >
                  Unpublish
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => saveDraft()}
                disabled={saving}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-gray-700 dark:border-neutral-700 dark:text-neutral-200"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save draft
              </button>
              {post.status !== "published" ? (
                <button
                  type="button"
                  onClick={publish}
                  disabled={saving}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white"
                >
                  <Send className="h-4 w-4" />
                  Publish
                </button>
              ) : (
                <span className="rounded-full bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  Published
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <main className="space-y-5">
              <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
                <input
                  value={post.title}
                  onChange={(event) => update("title", event.target.value)}
                  placeholder="Post title"
                  className="w-full border-0 bg-transparent text-3xl font-black tracking-tight text-gray-950 outline-none placeholder:text-gray-300 dark:text-white dark:placeholder:text-neutral-700"
                />
                <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                  <span>eatsdesk.com/blog/</span>
                  <input
                    value={post.slug}
                    disabled={slugLocked}
                    onChange={(event) => {
                      setSlugTouched(true);
                      update("slug", slugify(event.target.value));
                    }}
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1 font-mono text-xs outline-none focus:border-primary disabled:cursor-not-allowed disabled:opacity-70 dark:border-neutral-700 dark:bg-neutral-900"
                  />
                  {slugLocked ? (
                    <span
                      className="inline-flex items-center gap-1 text-xs"
                      title="Slug is locked after first publication"
                    >
                      <Lock className="h-3.5 w-3.5" />
                      Locked
                    </span>
                  ) : null}
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
                <div ref={editorRef} className="min-h-[520px]" />
                <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2 text-xs text-gray-500 dark:border-neutral-800">
                  <span>{wordCount.toLocaleString()} words</span>
                  <span>{estimatedReadTime} min read</span>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-semibold">Excerpt</label>
                  <span className="text-xs text-gray-400">
                    {post.excerpt.length}/200
                  </span>
                </div>
                <textarea
                  value={post.excerpt}
                  maxLength={200}
                  onChange={(event) => update("excerpt", event.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm outline-none focus:border-primary dark:border-neutral-700 dark:bg-neutral-900"
                  placeholder="Short summary shown on the blog listing page…"
                />
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
                <button
                  type="button"
                  onClick={() => setSeoOpen((open) => !open)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                >
                  <span>
                    <strong className="block text-sm">SEO settings</strong>
                    <span className="text-xs text-gray-500">
                      Search title, description, and Google preview
                    </span>
                  </span>
                  {seoOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {seoOpen ? (
                  <div className="space-y-4 border-t border-gray-100 p-5 dark:border-neutral-800">
                    <label className="block">
                      <span className="mb-1 flex justify-between text-sm font-semibold">
                        SEO title
                        <small className="font-normal text-gray-400">
                          {post.seoTitle.length}/60
                        </small>
                      </span>
                      <input
                        value={post.seoTitle}
                        maxLength={80}
                        onChange={(event) => update("seoTitle", event.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-primary dark:border-neutral-700 dark:bg-neutral-900"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 flex justify-between text-sm font-semibold">
                        SEO description
                        <small className="font-normal text-gray-400">
                          {post.seoDescription.length}/160
                        </small>
                      </span>
                      <textarea
                        value={post.seoDescription}
                        maxLength={160}
                        rows={3}
                        onChange={(event) =>
                          update("seoDescription", event.target.value)
                        }
                        className="w-full rounded-xl border border-gray-200 bg-white p-3 text-sm outline-none focus:border-primary dark:border-neutral-700 dark:bg-neutral-900"
                      />
                    </label>
                    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-900">
                      <p className="text-xs text-emerald-700">eatsdesk.com › blog › {post.slug}</p>
                      <p className="mt-1 text-lg text-blue-700">
                        {post.seoTitle || post.title || "Post title"} · EatsDesk
                      </p>
                      <p className="mt-1 text-sm text-gray-600 dark:text-neutral-300">
                        {post.seoDescription ||
                          post.excerpt ||
                          "Add an SEO description to preview it here."}
                      </p>
                    </div>
                  </div>
                ) : null}
              </section>
            </main>

            <aside className="space-y-5">
              <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <label className="block text-sm font-semibold">Cover image</label>
                {post.coverImage ? (
                  <img
                    src={post.coverImage}
                    alt=""
                    className="mt-3 aspect-video w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="mt-3 flex aspect-video items-center justify-center rounded-xl bg-gray-100 text-gray-400 dark:bg-neutral-900">
                    <ImagePlus className="h-7 w-7" />
                  </div>
                )}
                <input
                  value={post.coverImage}
                  onChange={(event) => update("coverImage", event.target.value)}
                  placeholder="https://…"
                  className="mt-3 h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs outline-none focus:border-primary dark:border-neutral-700 dark:bg-neutral-900"
                />
                <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-primary">
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-3.5 w-3.5" />
                  )}
                  Upload image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={uploadCover}
                    className="hidden"
                  />
                </label>
              </section>

              <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">Category</span>
                  <input
                    list="blog-categories"
                    value={post.category}
                    onChange={(event) => update("category", event.target.value)}
                    className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-primary dark:border-neutral-700 dark:bg-neutral-900"
                  />
                  <datalist id="blog-categories">
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">Tags</span>
                  <input
                    value={tagsInput}
                    onChange={(event) => setTagsInput(event.target.value)}
                    placeholder="pos, kitchen, growth"
                    className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-primary dark:border-neutral-700 dark:bg-neutral-900"
                  />
                  <div className="mt-2 flex flex-wrap gap-1">
                    {tagsInput
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean)
                      .map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-orange-50 px-2 py-1 text-[11px] font-medium text-orange-700 dark:bg-orange-500/10 dark:text-orange-300"
                        >
                          {tag}
                        </span>
                      ))}
                  </div>
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">Author</span>
                  <input
                    value={post.author}
                    onChange={(event) => update("author", event.target.value)}
                    className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-primary dark:border-neutral-700 dark:bg-neutral-900"
                  />
                </label>
                <label className="flex items-center justify-between gap-3">
                  <span>
                    <strong className="block text-sm">Featured post</strong>
                    <small className="text-xs text-gray-500">
                      Eligible for homepage promotion
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    checked={post.featured}
                    onChange={(event) => update("featured", event.target.checked)}
                    className="h-5 w-5 accent-primary"
                  />
                </label>
              </section>

              <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold">
                    Related city pages
                  </span>
                  <textarea
                    value={citiesInput}
                    onChange={(event) => setCitiesInput(event.target.value)}
                    rows={4}
                    placeholder="/restaurant-pos/portugal/lisbon, /restaurant-pos/spain/madrid"
                    className="w-full rounded-xl border border-gray-200 bg-white p-3 text-xs outline-none focus:border-primary dark:border-neutral-700 dark:bg-neutral-900"
                  />
                  <small className="mt-1 block text-xs leading-relaxed text-gray-500">
                    Comma-separated canonical paths. These appear as Popular
                    locations on the article.
                  </small>
                </label>
              </section>
            </aside>
          </div>
        </div>
      </SuperPageGate>
    </AdminLayout>
  );
}
