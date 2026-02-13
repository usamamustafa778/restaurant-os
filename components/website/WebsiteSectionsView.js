import SectionSlider from "./SectionSlider";

/**
 * Renders website sections using the same layout as the live restaurant website.
 * Shared by pages/r/[subdomain].js and dashboard website-content preview.
 *
 * @param {Object} props
 * @param {Array} props.websiteSections - [{ title, subtitle, isActive, items }], items are full menu objects
 * @param {string} props.primaryColor
 * @param {string} props.secondaryColor
 * @param {function} props.onItemClick - (item) => void, no-op for preview
 * @param {string} [props.sectionClassName] - optional extra class for each section
 * @param {boolean} [props.isPreview] - compact layout for dashboard preview (smaller sections)
 * @param {boolean} [props.forceMobile] - when true, use mobile layout (e.g. in preview mobile view)
 */
export default function WebsiteSectionsView({
  websiteSections = [],
  primaryColor = "#EF4444",
  secondaryColor = "#FFA500",
  onItemClick = () => {},
  sectionClassName = "",
  isPreview = false,
  forceMobile = false,
}) {
  const sections = websiteSections.filter(
    (s) => s && s.items && s.items.length > 0 && s.isActive !== false
  );

  if (sections.length === 0) return null;

  const sectionPy = isPreview ? "py-4" : "py-16";
  const headerMb = isPreview ? "mb-4" : "mb-10";
  const subtitleClass = isPreview ? "text-[10px] font-bold uppercase tracking-wider mb-1" : "text-sm font-bold uppercase tracking-widest mb-2";
  const titleClass = isPreview ? "text-base font-bold text-gray-900" : "text-3xl md:text-4xl font-bold text-gray-900";

  return (
    <>
      {sections.map((section, sIdx) => (
        <section
          key={sIdx}
          id={`section-${sIdx}`}
          className={`${sectionPy} ${sIdx % 2 === 0 ? "bg-gray-50" : "bg-white"} ${sectionClassName}`}
        >
          <div className="max-w-7xl mx-auto px-4">
            <div className={`text-center ${headerMb}`}>
              <p
                className={subtitleClass}
                style={{ color: secondaryColor }}
              >
                {section.subtitle || ""}
              </p>
              <h2 className={titleClass}>
                {section.title || `Section ${sIdx + 1}`}
              </h2>
            </div>

            {sIdx === 0 && (
              <SectionSlider
                items={section.items}
                visibleDesktop={4}
                visibleMobile={1}
                primaryColor={primaryColor}
                forceMobile={forceMobile}
                renderItem={(item) => (
                  <div
                    className="group text-center cursor-pointer"
                    onClick={() => onItemClick(item)}
                  >
                    <div className={`relative mx-auto ${isPreview ? "w-20 h-20 md:w-24 md:h-24" : "w-36 h-36 md:w-44 md:h-44"}`}>
                      <div
                        className="absolute inset-0 rounded-full border-2 border-dashed animate-spin-slow"
                        style={{ borderColor: primaryColor }}
                      />
                      <div className="absolute inset-1 rounded-full overflow-hidden group-hover:shadow-xl transition-shadow">
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />
                        )}
                      </div>
                    </div>
                    <div className={isPreview ? "mt-2" : "mt-4"}>
                      <h3 className={isPreview ? "text-xs font-bold text-gray-900 truncate" : "font-bold text-gray-900"}>{item.name}</h3>
                      <p className={isPreview ? "text-[10px] text-gray-600 mt-0.5" : "text-sm text-gray-600 mt-0.5"}>
                        {item.category || "Menu"}
                      </p>
                      <p
                        className={isPreview ? "text-xs font-bold mt-0.5" : "text-lg font-bold mt-1"}
                        style={{ color: primaryColor }}
                      >
                        PKR {item.price}
                      </p>
                    </div>
                  </div>
                )}
              />
            )}

            {sIdx === 1 && (
              <SectionSlider
                items={section.items}
                visibleDesktop={5}
                visibleMobile={2}
                primaryColor={primaryColor}
                forceMobile={forceMobile}
                renderItem={(item) => (
                  <div
                    className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-all group cursor-pointer"
                    onClick={() => onItemClick(item)}
                  >
                    <div className={`relative overflow-hidden ${isPreview ? "h-28" : "h-44"}`}>
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />
                      )}
                    </div>
                    <div className={isPreview ? "p-2" : "p-3"}>
                      <h3 className={isPreview ? "font-semibold text-gray-900 text-xs truncate" : "font-semibold text-gray-900 text-sm"}>
                        {item.name}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {item.category || "Menu"}
                      </p>
                      <p
                        className={isPreview ? "text-xs font-bold mt-0.5" : "text-base font-bold mt-1"}
                        style={{ color: primaryColor }}
                      >
                        PKR {item.price}
                      </p>
                    </div>
                  </div>
                )}
              />
            )}

            {sIdx === 2 && (
              <SectionSlider
                items={section.items}
                visibleDesktop={3}
                visibleMobile={1}
                primaryColor={primaryColor}
                forceMobile={forceMobile}
                renderItem={(item) => (
                  <div
                    className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg group transition-shadow cursor-pointer"
                    onClick={() => onItemClick(item)}
                  >
                    <div className={`relative ${isPreview ? "h-32" : "h-48"}`}>
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full group-hover:scale-105 transition-transform duration-300 h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />
                      )}
                    </div>
                    <div className={isPreview ? "p-2" : "p-4"}>
                      <div className={`flex items-start justify-between ${isPreview ? "mb-1" : "mb-2"}`}>
                        <h3 className={isPreview ? "font-bold text-gray-900 text-xs truncate" : "font-bold text-gray-900 text-lg"}>
                          {item.name}
                        </h3>
                        <span
                          className={isPreview ? "text-xs font-bold" : "text-lg font-bold"}
                          style={{ color: primaryColor }}
                        >
                          PKR {item.price}
                        </span>
                      </div>
                      <p className={`${isPreview ? "text-[10px] text-gray-600 mb-2 line-clamp-1" : "text-sm text-gray-600 mb-4 max-w-[250px] line-clamp-2"}`}>
                        {item.description || ""}
                      </p>
                      <button
                        type="button"
                        className={`rounded-lg text-white font-semibold hover:opacity-90 transition-opacity ${isPreview ? "w-full py-1 text-[10px]" : "w-full py-2"}`}
                        style={{ backgroundColor: primaryColor }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onItemClick(item);
                        }}
                      >
                        Add to Cart
                      </button>
                    </div>
                  </div>
                )}
              />
            )}

            {sIdx > 2 && (
              <SectionSlider
                items={section.items}
                visibleDesktop={4}
                visibleMobile={2}
                primaryColor={primaryColor}
                forceMobile={forceMobile}
                renderItem={(item) => (
                  <div
                    className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow group cursor-pointer"
                    onClick={() => onItemClick(item)}
                  >
                    <div className={`relative overflow-hidden ${isPreview ? "h-28" : "h-40"}`}>
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />
                      )}
                      <div className="absolute top-2 right-2">
                        <span
                          className="px-2 py-1 rounded-full bg-white/95 text-sm font-bold"
                          style={{ color: primaryColor }}
                        >
                          PKR {item.price}
                        </span>
                      </div>
                    </div>
                    <div className={isPreview ? "p-2" : "p-3"}>
                      <h3 className={isPreview ? "font-semibold text-gray-900 text-xs mb-0.5 truncate" : "font-semibold text-gray-900 text-sm mb-1"}>
                        {item.name}
                      </h3>
                      <p className={isPreview ? "text-[10px] text-gray-600 line-clamp-1" : "text-xs text-gray-600 line-clamp-2"}>
                        {item.description || ""}
                      </p>
                    </div>
                  </div>
                )}
              />
            )}
          </div>
        </section>
      ))}
    </>
  );
}
