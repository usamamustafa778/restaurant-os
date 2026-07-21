import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminLayout from "../../../components/layout/AdminLayout";
import SuperPageGate from "../../../components/super/SuperPageGate";
import { usePermissions } from "../../../contexts/PermissionContext";
import {
  deleteBlogPostForSuperAdmin,
  getBlogPostsForSuperAdmin,
  publishBlogPostForSuperAdmin,
  unpublishBlogPostForSuperAdmin,
} from "../../../lib/apiClient";
import {
  BookOpen,
  Edit3,
  Loader2,
  Plus,
  Search,
  Star,
  Trash2,
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

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

export default function SuperBlogPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("platform.blog.manage");
  const canDelete = hasPermission("platform.blog.delete");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getBlogPostsForSuperAdmin({
        search: search.trim(),
        status,
        category,
      });
      setPosts(Array.isArray(data?.posts) ? data.posts : []);
    } catch (error) {
      toast.error(error.message || "Failed to load blog posts");
    } finally {
      setLoading(false);
    }
  }, [search, status, category]);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  const categories = useMemo(
    () =>
      [...new Set([...CATEGORIES, ...posts.map((post) => post.category)])].filter(
        Boolean,
      ),
    [posts],
  );

  async function togglePublished(post) {
    try {
      setBusyId(post._id);
      if (post.status === "published") {
        await unpublishBlogPostForSuperAdmin(post._id);
        toast.success("Post moved to draft");
      } else {
        await publishBlogPostForSuperAdmin(post._id);
        toast.success("Post published");
      }
      await load();
    } catch (error) {
      toast.error(error.message || "Could not update status");
    } finally {
      setBusyId("");
    }
  }

  async function removePost(post) {
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) return;
    try {
      setBusyId(post._id);
      await deleteBlogPostForSuperAdmin(post._id);
      toast.success("Post deleted");
      await load();
    } catch (error) {
      toast.error(error.message || "Could not delete post");
    } finally {
      setBusyId("");
    }
  }

  return (
    <AdminLayout
      title="Blog CMS"
      subtitle="Create and publish content for eatsdesk.com."
    >
      <SuperPageGate permission="platform.blog.view">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by title…"
                className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-primary dark:border-neutral-700 dark:bg-neutral-900"
              />
            </div>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            >
              <option value="">All categories</option>
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            {canManage ? (
              <Link
                href="/super/blog/new"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" />
                New post
              </Link>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
            {loading ? (
              <div className="flex min-h-[320px] items-center justify-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Loading posts…
              </div>
            ) : posts.length === 0 ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                <BookOpen className="mb-3 h-9 w-9 text-gray-300" />
                <p className="font-semibold text-gray-700 dark:text-neutral-200">
                  No posts found
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Create the first post or change your filters.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-neutral-800 dark:bg-neutral-900/70">
                    <tr>
                      <th className="px-4 py-3">Title</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Published</th>
                      <th className="px-4 py-3">Author</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
                    {posts.map((post) => (
                      <tr key={post._id} className="hover:bg-gray-50/70 dark:hover:bg-neutral-900/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {post.featured ? (
                              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            ) : null}
                            <div>
                              <p className="max-w-[360px] truncate font-semibold text-gray-900 dark:text-white">
                                {post.title}
                              </p>
                              <p className="mt-0.5 text-xs text-gray-400">/{post.slug}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-neutral-300">
                          {post.category || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              post.status === "published"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                                : "bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-300"
                            }`}
                          >
                            {post.status === "published" ? "Published" : "Draft"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {formatDate(post.publishedAt)}
                        </td>
                        <td className="px-4 py-3 text-gray-500">{post.author || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {canManage ? (
                              <button
                                type="button"
                                disabled={busyId === post._id}
                                onClick={() => togglePublished(post)}
                                className={`relative h-6 w-11 rounded-full transition ${
                                  post.status === "published"
                                    ? "bg-emerald-500"
                                    : "bg-gray-300 dark:bg-neutral-700"
                                }`}
                                title={
                                  post.status === "published"
                                    ? "Unpublish"
                                    : "Quick publish"
                                }
                              >
                                <span
                                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                                    post.status === "published"
                                      ? "translate-x-5"
                                      : "translate-x-0"
                                  }`}
                                />
                              </button>
                            ) : null}
                            <Link
                              href={`/super/blog/${post._id}`}
                              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-primary dark:hover:bg-neutral-800"
                              title="Edit"
                            >
                              <Edit3 className="h-4 w-4" />
                            </Link>
                            {canDelete ? (
                              <button
                                type="button"
                                onClick={() => removePost(post)}
                                disabled={busyId === post._id}
                                className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </SuperPageGate>
    </AdminLayout>
  );
}
