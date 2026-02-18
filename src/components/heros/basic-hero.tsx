const BasicHero = ({ title, description }: { title: string, description: string }) => {
  return (
    <section className="bg-gray-300 text-black">
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">{title}</h1>
          <p className="mb-0">
            {description}
          </p>
        </div>
      </div>
    </section>
  )
}

export default BasicHero